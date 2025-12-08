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

// --- utils locales ---
function startOfMonthUTC(year, month) {
  return new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
}
function endOfMonthUTC(year, month) {
  return new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
}
function datesForWeekdayInMonth(year, month, dayOfWeek) {
  // month: 1..12 ; dayOfWeek: 0..6 (0=Dom, 1=Lun, 2=Mar, ...)
  const end = endOfMonthUTC(year, month);
  const first = new Date(Date.UTC(year, month - 1, 1));
  const offset = (dayOfWeek - first.getUTCDay() + 7) % 7;
  let d = new Date(Date.UTC(year, month - 1, 1 + offset));

  const result = [];
  const limit = dayOfWeek ? 4 : Infinity;
  while (d <= end) {
    result.push(new Date(d));
    if (result.length >= limit) break; // corta en la 4.ª ocurrencia
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
  const only = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
  return only.toISOString();
}

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

    // 1) Schedules vigentes
    let schedules = await ProfessorSchedule.find({
      branch: branchId,
      effectiveFrom: { $lte: monthStart },
      $or: [{ effectiveTo: null }, { effectiveTo: { $gt: monthStart } }],
    }).lean();

    // Disabled classes del mes
    const disabledClasses = await DisabledClass.find({
      start: { $gte: monthStart.toISOString(), $lte: monthEnd.toISOString() },
    }).lean();
    const disabledKeys = new Set(disabledClasses.map((d) => d.key));

    // Filtrado opcional por professorIds
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

    // 2) Users (name + capacidad)
    const users = await User.find({
      _id: { $in: professorIds },
      branch: branchId,
      role: "professor",
      state: true,
    })
      .select("_id name capacity")
      .lean();
    const userById = new Map(users.map((u) => [String(u._id), u]));

    // 3) Inscripciones del mes -> traer student + _id + chosenSlots + assigned
    const enrollments = await Enrollment.find({
      professor: { $in: professorIds },
      year,
      month,
      $or: [{ state: "activa" }, { estado: "activa" }],
    })
      .select("_id student professor chosenSlots assigned")
      .lean();

    // Preprocesar: map slotKey -> Set of enrollment docs (IDs)
    // slotKey necesita la forma slotKey(slotObj, professorId)
    const enrollmentsBySlot = new Map(); // `${profId}|${slotKey}` -> Set of enrollment docs
    const enrollmentById = new Map(); // enrollmentId -> enrollment doc
    for (const e of enrollments) {
      const enId = String(e._id);
      enrollmentById.set(enId, e);
      if (e.assigned !== true) continue;
      const pid = String(e.professor);
      for (const s of e.chosenSlots || []) {
        const k = slotKey(s, pid);
        const mapKey = `${pid}|${k}`;
        if (!enrollmentsBySlot.has(mapKey))
          enrollmentsBySlot.set(mapKey, new Set());
        enrollmentsBySlot.get(mapKey).add(enId);
      }
    }

    // 4) Reprogramaciones del mes (detallar por enrollment y student)
    const reschedules = await StudentReschedule.find({
      year,
      month,
      $or: [
        { fromProfessor: { $in: professorIds } },
        { toProfessor: { $in: professorIds } },
        { professor: { $in: professorIds } }, // compat legado
      ],
    })
      .select(
        "enrollment student fromProfessor toProfessor fromDate toDate slotFrom slotTo"
      )
      .lean();

    // Mapear por key => sets
    const movedInEnroll = new Map(); // `${pid}|${dateISO}|${slotKey}` -> Set(enrollmentId)
    const movedInStudents = new Map(); // same key -> Set(studentId)
    const movedOutEnroll = new Map(); // `${pid}|${dateISO}|${slotKey}` -> Set(enrollmentId)
    const movedOutStudents = new Map(); // same key -> Set(studentId)

    const addToSetMap = (map, key, val) => {
      if (!map.has(key)) map.set(key, new Set());
      map.get(key).add(val);
    };

    for (const r of reschedules) {
      const toProf = String(r.toProfessor || r.professor || "");
      const fromProf = String(r.fromProfessor || "");
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

    // 5) ADHOC: Asistencias ad-hoc del mes (traer student/enrollment)
    const adhoc = await Attendance.find({
      origin: { $ne: "regular" },
      branch: branchId,
      professor: { $in: professorIds },
      date: { $gte: monthStart, $lte: monthEnd },
      removed: { $ne: true },
    })
      .select("professor date slotSnapshot student enrollment")
      .lean();

    // map adhoc attendances -> Set(studentId) and Set(enrollmentId) per key
    const adhocStudentMap = new Map(); // `${pid}|${dateISO}|${slotKey}` -> Set(studentId)
    const adhocEnrollmentMap = new Map(); // same key -> Set(enrollmentId)
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

    // 6) Regular removed (attendance marked removed for regular origin)
    const regularRemoved = await Attendance.find({
      origin: "regular",
      professor: { $in: professorIds },
      date: { $gte: monthStart, $lte: monthEnd },
      removed: true,
      slotSnapshot: { $exists: true },
    })
      .select("professor date slotSnapshot enrollment student")
      .lean();

    const regularRemovedEnrollMap = new Map(); // key -> Set(enrollmentId)
    const regularRemovedStudentMap = new Map(); // key -> Set(studentId)
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

    // 7) Adhoc classes (documentos de clase ad-hoc con lista de students)
    const adhocClasses = await AdhocClass.find({
      professor: { $in: professorIds },
      branch: branchId,
      date: { $gte: monthStart, $lte: monthEnd },
      removed: { $ne: true },
    })
      .select("professor date slotSnapshot students capacity")
      .lean();

    // 8) Expandir a eventos por día del mes
    const events = [];
    for (const sc of schedules) {
      const pid = String(sc.professor);
      const prof = userById.get(pid);

      const profName = prof?.name || "Profesor";
      const capacity = Math.max(1, Number(prof?.capacity ?? 10));

      for (const s of sc.slots) {
        const k = slotKey(s, pid);
        const dates = datesForWeekdayInMonth(year, month, s.dayOfWeek);

        // Pre-get map key prefix for enrollments assigned to this slot (monthly)
        const mapKeySlot = `${pid}|${k}`;
        const enrollSetForSlot = enrollmentsBySlot.get(mapKeySlot) || new Set();

        for (const day of dates) {
          const iso = dateOnlyISO(day);
          const key = `${pid}|${iso}|${k}`;

          // dayStudents será el set final de studentIds únicos para esa fecha+slot
          const dayStudents = new Set();

          // 1) Añadir estudiantes de las enrollments asignadas a este slot (siempre que existan)
          for (const enId of enrollSetForSlot) {
            const en = enrollmentById.get(enId);
            if (!en) continue;
            if (!en.student) continue;
            dayStudents.add(String(en.student));
          }

          // 2) Quitar los movedOut (por enrollment o student)
          if (movedOutEnroll.has(key)) {
            for (const enId of movedOutEnroll.get(key)) {
              const enDoc = enrollmentById.get(enId);
              if (enDoc && enDoc.student)
                dayStudents.delete(String(enDoc.student));
            }
          }
          if (movedOutStudents.has(key)) {
            for (const sId of movedOutStudents.get(key)) {
              dayStudents.delete(sId);
            }
          }

          // 3) Añadir movedIn (por enrollment o student)
          if (movedInEnroll.has(key)) {
            for (const enId of movedInEnroll.get(key)) {
              const enDoc = enrollmentById.get(enId);
              if (enDoc && enDoc.student)
                dayStudents.add(String(enDoc.student));
              else {
                // si no tenemos enrollment en este mes (posible), no confiar — intentar extraer student via query no disponible aquí
                // por seguridad, si movedInEnroll trae enId que no está en enrollmentById, no lo contamos (podés extender para buscarlos)
              }
            }
          }
          if (movedInStudents.has(key)) {
            for (const sId of movedInStudents.get(key)) {
              dayStudents.add(sId);
            }
          }

          // 4) Añadir asistencias adhoc (students) para ese key
          if (adhocStudentMap.has(key)) {
            for (const sId of adhocStudentMap.get(key)) dayStudents.add(sId);
          }
          // (también podemos añadir adhocEnrollmentMap: si una attendance adhoc está vinculada a una enrollment, aseguramos el student)
          if (adhocEnrollmentMap.has(key)) {
            for (const enId of adhocEnrollmentMap.get(key)) {
              const enDoc = enrollmentById.get(enId);
              if (enDoc && enDoc.student)
                dayStudents.add(String(enDoc.student));
            }
          }

          // 5) Quitar regular removed (si hay attendance removed para el enrollment o student)
          if (regularRemovedEnrollMap.has(key)) {
            for (const enId of regularRemovedEnrollMap.get(key)) {
              const enDoc = enrollmentById.get(enId);
              if (enDoc && enDoc.student)
                dayStudents.delete(String(enDoc.student));
            }
          }
          if (regularRemovedStudentMap.has(key)) {
            for (const sId of regularRemovedStudentMap.get(key)) {
              dayStudents.delete(sId);
            }
          }

          // Finalmente takenDay = cantidad unica de alumnos
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

    // 9) Procesar adhocClasses (eventos independientes de ad-hoc clase)
    for (const ac of adhocClasses) {
      const pid = String(ac.professor);
      const iso = dateOnlyISO(new Date(ac.date));
      const k = slotKey(ac.slotSnapshot, pid);

      // students inscritos en la AdhocClass (array de ids)
      const enrolledStudentsInAc = new Set(
        (ac.students || []).map((x) => String(x))
      );

      // asistentes adhoc registrados como Attendance para esa key (puede incluir alumnos no en ac.students)
      const adhocAttendanceSet =
        adhocStudentMap.get(`${pid}|${iso}|${k}`) || new Set();

      // combinar ambos sets para unicidad
      const combined = new Set(enrolledStudentsInAc);
      for (const sId of adhocAttendanceSet) combined.add(sId);

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
