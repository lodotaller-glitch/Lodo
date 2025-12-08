import { NextResponse } from "next/server";
import {
  ProfessorSchedule,
  Enrollment,
  User,
  StudentReschedule,
  Attendance,
  DisabledClass,
} from "@/models";
import dbConnect from "@/lib/dbConnect";
import { slotKey } from "@/functions/slotKey";
import AdhocClass from "@/models/AdhocClass";

// ------------------------------------
// Utils
// ------------------------------------
function startOfMonthUTC(year, month) {
  return new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
}

function endOfMonthUTC(year, month) {
  return new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
}

function datesForWeekdayInMonth(year, month, dayOfWeek) {
  const end = endOfMonthUTC(year, month);
  const first = new Date(Date.UTC(year, month - 1, 1));
  const offset = (dayOfWeek - first.getUTCDay() + 7) % 7;

  let d = new Date(Date.UTC(year, month - 1, 1 + offset));
  const result = [];
  const limit = dayOfWeek ? 4 : Infinity;

  while (d <= end) {
    result.push(new Date(d));
    if (result.length >= limit) break;
    d = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 7)
    );
  }

  return result;
}

function buildDateTimeUTC(dateOnlyUTC, minutesFromMidnight) {
  const h = Math.floor(minutesFromMidnight / 60);
  const m = minutesFromMidnight % 60;

  return new Date(
    Date.UTC(
      dateOnlyUTC.getUTCFullYear(),
      dateOnlyUTC.getUTCMonth(),
      dateOnlyUTC.getUTCDate(),
      h,
      m,
      0,
      0
    )
  );
}

function dateOnlyISO(d) {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  ).toISOString();
}

// ------------------------------------
// MAIN HANDLER
// ------------------------------------
export async function GET(req, { params }) {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const year = Number(searchParams.get("year"));
    const month = Number(searchParams.get("month"));
    const professorIdsParam = searchParams.get("professorIds");
    const { branchId } = await params;

    if (
      !Number.isInteger(year) ||
      !Number.isInteger(month) ||
      month < 1 ||
      month > 12
    ) {
      return NextResponse.json(
        { error: "Parámetros year/month inválidos" },
        { status: 400 }
      );
    }

    const monthStart = startOfMonthUTC(year, month);
    const monthEnd = endOfMonthUTC(year, month);

    // ------------------------------------
    // 1. Schedules vigentes
    // ------------------------------------
    let schedules = await ProfessorSchedule.find({
      branch: branchId,
      effectiveFrom: { $lte: monthStart },
      $or: [{ effectiveTo: null }, { effectiveTo: { $gt: monthStart } }],
    }).lean();

    // Disabled classes
    const disabledClasses = await DisabledClass.find({
      start: { $gte: monthStart.toISOString(), $lte: monthEnd.toISOString() },
    }).lean();
    const disabledKeys = new Set(disabledClasses.map((d) => d.key));

    // Filtrado por profesor
    let filtroIds = null;
    if (professorIdsParam?.trim()) {
      filtroIds = professorIdsParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      schedules = schedules.filter((sc) =>
        filtroIds.includes(String(sc.professor))
      );
    }

    const professorSet = new Set(schedules.map((s) => String(s.professor)));
    if (professorSet.size === 0) return NextResponse.json({ events: [] });

    const professorIds = [...professorSet];

    // ------------------------------------
    // 2. Profesores
    // ------------------------------------
    const users = await User.find({
      _id: { $in: professorIds },
      branch: branchId,
      role: "professor",
      state: true,
    })
      .select("_id name capacity")
      .lean();

    const userById = new Map(users.map((u) => [String(u._id), u]));

    // ------------------------------------
    // 3. Enrollments
    // ------------------------------------
    const enrollments = await Enrollment.find({
      professor: { $in: professorIds },
      year,
      month,
      $or: [{ state: "activa" }, { estado: "activa" }],
    })
      .select("_id student professor chosenSlots assigned")
      .lean();

    const enrollmentById = new Map();
    for (const e of enrollments) enrollmentById.set(String(e._id), e);

    // ------------------------------------
    // 4. Reschedules
    // ------------------------------------
    const reschedules = await StudentReschedule.find({
      year,
      month,
      $or: [
        { fromProfessor: { $in: professorIds } },
        { toProfessor: { $in: professorIds } },
        { professor: { $in: professorIds } },
      ],
    })
      .select(
        "enrollment student fromProfessor toProfessor fromDate toDate slotFrom slotTo"
      )
      .lean();

      console.log(reschedules);
      

    const movedInEnroll = new Map();
    const movedInStudents = new Map();
    const movedOutEnroll = new Map();
    const movedOutStudents = new Map();

    const addToSetMap = (map, key, val) => {
      if (!map.has(key)) map.set(key, new Set());
      map.get(key).add(val);
    };

    for (const r of reschedules) {
      const toProf = r.toProfessor ? String(r.toProfessor) : null;
      const fromProf = r.fromProfessor ? String(r.fromProfessor) : null;
      const toDayISO = r.toDate ? dateOnlyISO(new Date(r.toDate)) : null;
      const fromDayISO = r.fromDate ? dateOnlyISO(new Date(r.fromDate)) : null;
      const enId = r.enrollment ? String(r.enrollment) : null;
      const studId = r.student ? String(r.student) : null;

      if (toProf && toDayISO && r.slotTo) {
        const kSlotTo = slotKey(r.slotTo, toProf);
        const key = `${toProf}|${toDayISO}|${kSlotTo}`;
        if (enId) addToSetMap(movedInEnroll, key, enId);
        if (studId) addToSetMap(movedInStudents, key, studId);
      }

      if (fromProf && fromDayISO && r.slotFrom) {
        const kSlotFrom = slotKey(r.slotFrom, fromProf);
        const key = `${fromProf}|${fromDayISO}|${kSlotFrom}`;
        if (enId) addToSetMap(movedOutEnroll, key, enId);
        if (studId) addToSetMap(movedOutStudents, key, studId);
      }
    }

    // ------------------------------------
    // 5. Adhoc Attendance
    // ------------------------------------
    const adhoc = await Attendance.find({
      origin: { $ne: "regular" },
      branch: branchId,
      date: { $gte: monthStart, $lte: monthEnd },
      removed: { $ne: true },
    })
      .select("professor date slotSnapshot student enrollment")
      .lean();

    const adhocStudentMap = new Map();
    const adhocEnrollmentMap = new Map();

    for (const a of adhoc) {
      if (!a.slotSnapshot) continue;
      const pid = String(a.professor);
      const iso = dateOnlyISO(new Date(a.date));
      const k = slotKey(a.slotSnapshot, pid);
      const key = `${pid}|${iso}|${k}`;

      if (a.student) addToSetMap(adhocStudentMap, key, String(a.student));
      if (a.enrollment)
        addToSetMap(adhocEnrollmentMap, key, String(a.enrollment));
    }

    // ------------------------------------
    // 6. Regular removed
    // ------------------------------------
    const regularRemoved = await Attendance.find({
      origin: "regular",
      professor: { $in: professorIds },
      date: { $gte: monthStart, $lte: monthEnd },
      removed: true,
      slotSnapshot: { $exists: true },
    })
      .select("professor date slotSnapshot enrollment student")
      .lean();

    const regularRemovedEnrollMap = new Map();
    const regularRemovedStudentMap = new Map();

    for (const a of regularRemoved) {
      if (!a.slotSnapshot) continue;
      const pid = String(a.professor);
      const iso = dateOnlyISO(new Date(a.date));
      const k = slotKey(a.slotSnapshot, pid);
      const key = `${pid}|${iso}|${k}`;

      if (a.enrollment)
        addToSetMap(regularRemovedEnrollMap, key, String(a.enrollment));
      if (a.student)
        addToSetMap(regularRemovedStudentMap, key, String(a.student));
    }

    // ------------------------------------
    // 7. Adhoc Classes
    // ------------------------------------
    const adhocClasses = await AdhocClass.find({
      professor: { $in: professorIds },
      branch: branchId,
      date: { $gte: monthStart, $lte: monthEnd },
      removed: { $ne: true },
    })
      .select("professor date slotSnapshot students capacity")
      .lean();

    // ------------------------------------
    // 8. Expand calendar events
    // ------------------------------------
    const events = [];

    for (const sc of schedules) {
      const pid = String(sc.professor);
      const prof = userById.get(pid);
      const profName = prof?.name || "Profesor";
      const capacity = Math.max(1, Number(prof?.capacity ?? 10));

      for (const s of sc.slots) {
        const k = slotKey(s, pid);
        const dates = datesForWeekdayInMonth(year, month, s.dayOfWeek);

        for (const day of dates) {
          const iso = dateOnlyISO(day);
          const key = `${pid}|${iso}|${k}`;

          const dayStudents = new Set();

          // --------------------------
          // *** FIX PRINCIPAL ***
          // Cohesión con /classes:
          // Tomar solo enrollments que realmente tienen ese día/slot
          // --------------------------
          for (const e of enrollments) {
            if (String(e.professor) !== pid) continue;
            if (e.assigned !== true) continue;
            if (!e.student) continue;

            const match = (e.chosenSlots || []).some(
              (sl) =>
                sl.dayOfWeek === s.dayOfWeek &&
                sl.startMin === s.startMin &&
                sl.endMin === s.endMin
            );

            if (match) dayStudents.add(String(e.student));
          }

          // Moved OUT
          if (movedOutEnroll.has(key)) {
            for (const enId of movedOutEnroll.get(key)) {
              const enDoc = enrollmentById.get(enId);
              if (enDoc?.student) dayStudents.delete(String(enDoc.student));
            }
          }

          if (movedOutStudents.has(key)) {
            for (const sid of movedOutStudents.get(key)) {
              dayStudents.delete(sid);
            }
          }

          // Moved IN
          if (movedInEnroll.has(key)) {
            for (const enId of movedInEnroll.get(key)) {
              const enDoc = enrollmentById.get(enId);
              if (enDoc?.student) dayStudents.add(String(enDoc.student));
            }
          }

          if (movedInStudents.has(key)) {
            for (const sid of movedInStudents.get(key)) {
              dayStudents.add(sid);
            }
          }

          // Adhoc Attendance
          if (adhocStudentMap.has(key)) {
            for (const sid of adhocStudentMap.get(key)) dayStudents.add(sid);
          }

          if (adhocEnrollmentMap.has(key)) {
            for (const enId of adhocEnrollmentMap.get(key)) {
              const enDoc = enrollmentById.get(enId);
              if (enDoc?.student) dayStudents.add(String(enDoc.student));
            }
          }

          // Regular removed
          if (regularRemovedEnrollMap.has(key)) {
            for (const enId of regularRemovedEnrollMap.get(key)) {
              const enDoc = enrollmentById.get(enId);
              if (enDoc?.student) dayStudents.delete(String(enDoc.student));
            }
          }

          if (regularRemovedStudentMap.has(key)) {
            for (const sid of regularRemovedStudentMap.get(key)) {
              dayStudents.delete(sid);
            }
          }

          // Result
          const takenDay = dayStudents.size;
          const leftDay = Math.max(0, capacity - takenDay);
          const status = leftDay > 0 ? "available" : "full";

          const startISO = buildDateTimeUTC(day, s.startMin).toISOString();
          const disabled = disabledKeys.has(`${startISO}_${k}`);

          events.push({
            title: `${profName} (${takenDay}/${capacity})`,
            start: buildDateTimeUTC(day, s.startMin),
            end: buildDateTimeUTC(day, s.endMin),
            professorId: pid,
            professorName: profName,
            slotKey: k,
            weekday: s.dayOfWeek,
            capacityLeft: leftDay,
            status,
            disabled,
            _id: sc._id,
          });
        }
      }
    }

    // ------------------------------------
    // 9. Adhoc Classes como eventos
    // ------------------------------------
    for (const ac of adhocClasses) {
      const pid = String(ac.professor);
      const iso = dateOnlyISO(new Date(ac.date));
      const k = slotKey(ac.slotSnapshot, pid);

      const enrolledStudentsInAc = new Set(
        (ac.students || []).map((x) => String(x))
      );
      const adhocAttendanceSet =
        adhocStudentMap.get(`${pid}|${iso}|${k}`) || new Set();

      const combined = new Set([
        ...enrolledStudentsInAc,
        ...adhocAttendanceSet,
      ]);

      const takenDay = combined.size;
      const capacity =
        ac.capacity || Math.max(1, Number(userById.get(pid)?.capacity ?? 10));
      const leftDay = Math.max(0, capacity - takenDay);
      const status = leftDay > 0 ? "available" : "full";

      const startISO2 = buildDateTimeUTC(
        new Date(ac.date),
        ac.slotSnapshot.startMin
      ).toISOString();
      const disabled2 = disabledKeys.has(`${startISO2}_${k}`);

      events.push({
        title: `${
          userById.get(pid)?.name || "Profesor"
        } (${takenDay}/${capacity}) Clase ad-hoc`,
        start: buildDateTimeUTC(new Date(ac.date), ac.slotSnapshot.startMin),
        end: buildDateTimeUTC(new Date(ac.date), ac.slotSnapshot.endMin),
        professorId: pid,
        professorName: userById.get(pid)?.name || "Profesor",
        slotKey: k,
        capacityLeft: leftDay,
        status,
        disabled: disabled2,
        _id: ac._id,
        isAdhocClass: true,
      });
    }

    events.sort((a, b) => a.start - b.start);

    return NextResponse.json({ events });
  } catch (err) {
    console.error("GET /api/calendar error:", err);
    return NextResponse.json(
      { error: "Error del servidor", details: err?.message },
      { status: 500 }
    );
  }
}
