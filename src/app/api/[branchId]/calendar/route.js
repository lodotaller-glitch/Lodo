import { NextResponse } from "next/server";
import {
  ProfessorSchedule,
  Enrollment,
  User,
  StudentReschedule,
  Attendance, // 👈 ADHOC: importar Attendance
} from "@/models";
import dbConnect from "@/lib/dbConnect";
import { slotKey } from "@/functions/slotKey";

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
    if (result.length >= limit) break; // 👈 corta en la 4.ª ocurrencia
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
    const monthEnd = endOfMonthUTC(year, month); // 👈 ADHOC

    // 1) Schedules vigentes
    let schedules = await ProfessorSchedule.find({
      branch: branchId,
      effectiveFrom: { $lte: monthStart },
      $or: [{ effectiveTo: null }, { effectiveTo: { $gt: monthStart } }],
    }).lean();

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

    // 3) Inscripciones del mes
    const enrollments = await Enrollment.find({
      professor: { $in: professorIds },
      year,
      month,
      $or: [{ state: "activa" }],
    })
      .select("professor chosenSlots assigned asignado")
      .lean();

    // 4) Conteo base por (profesor, slot) mensual
    const counts = new Map(); // profId -> Map(slotKey -> count)
    for (const e of enrollments) {
      const isAssigned = e.assigned === true;
      if (!isAssigned) continue;

      const pid = String(e.professor);
      if (!counts.has(pid)) counts.set(pid, new Map());
      const inner = counts.get(pid);

      for (const s of e.chosenSlots || []) {
        const k = slotKey(s, pid);
        inner.set(k, (inner.get(k) || 0) + 1);
      }
    }

    // 4.5) Reprogramaciones del mes (ajustes por día)
    const reschedules = await StudentReschedule.find({
      year,
      month,
      $or: [
        { fromProfessor: { $in: professorIds } },
        { toProfessor: { $in: professorIds } },
        { professor: { $in: professorIds } }, // compat legado
      ],
    }).lean();

    const movedIn = new Map(); // `${pid}|${dateISO}|${slotKey}` -> n
    const movedOut = new Map(); // idem
    const inc = (map, k) => map.set(k, (map.get(k) || 0) + 1);

    for (const r of reschedules) {
      const toProf = String(r.toProfessor || r.professor || "");
      const fromProf = String(r.fromProfessor || "");
      const toDayISO = r.toDate ? dateOnlyISO(new Date(r.toDate)) : null;
      const fromDayISO = r.fromDate ? dateOnlyISO(new Date(r.fromDate)) : null;

      if (toProf && toDayISO && r.slotTo) {
        const kSlotTo = slotKey(r.slotTo, toProf);
        inc(movedIn, `${toProf}|${toDayISO}|${kSlotTo}`);
      }
      if (fromProf && fromDayISO && r.slotFrom) {
        const kSlotFrom = slotKey(r.slotFrom, fromProf);
        inc(movedOut, `${fromProf}|${fromDayISO}|${kSlotFrom}`);
      }
    }

    // 4.6) 👈 ADHOC: Asistencias ad-hoc del mes (una sola clase)
    const adhoc = await Attendance.find({
      origin: "adhoc",
      branch: branchId,
      professor: { $in: professorIds },
      date: { $gte: monthStart, $lte: monthEnd },
      removed: { $ne: true },
    })
      .select("professor date slotSnapshot")
      .lean();

    const adhocIn = new Map(); // `${pid}|${dateISO}|${slotKey}` -> n
    for (const a of adhoc) {
      if (!a.slotSnapshot) continue;
      const pid = String(a.professor);
      const iso = dateOnlyISO(new Date(a.date));
      const k = slotKey(a.slotSnapshot, pid);
      inc(adhocIn, `${pid}|${iso}|${k}`);
    }

    // 5) Expandir a eventos por día del mes
    const events = [];
    for (const sc of schedules) {
      const pid = String(sc.professor);
      const prof = userById.get(pid);

      const profName = prof?.name || "Profesor";
      const capacity = Math.max(
        1,
        Number(prof?.capacity ?? 10)
      );
      const inner = counts.get(pid) || new Map();

      for (const s of sc.slots) {
        const k = slotKey(s, pid);
        const takenBase = inner.get(k) || 0;

        const dates = datesForWeekdayInMonth(year, month, s.dayOfWeek);
        for (const day of dates) {
          const iso = dateOnlyISO(day);
          const outDay = movedOut.get(`${pid}|${iso}|${k}`) || 0;
          const inDay = movedIn.get(`${pid}|${iso}|${k}`) || 0;
          const adhocDay = adhocIn.get(`${pid}|${iso}|${k}`) || 0; // 👈 ADHOC

          const takenDay = Math.max(0, takenBase - outDay + inDay + adhocDay); // 👈 ADHOC sumado
          const leftDay = Math.max(0, capacity - takenDay);
          const status = leftDay > 0 ? "available" : "full";

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
            _id: sc._id,
          });
        }
      }
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
