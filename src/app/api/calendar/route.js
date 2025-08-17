import { NextResponse } from "next/server";
import { ProfessorSchedule, Enrollment, User } from "@/models";
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
  const end = endOfMonthUTC(year, month);
  const first = new Date(Date.UTC(year, month - 1, 1));
  const offset = (dayOfWeek - first.getUTCDay() + 7) % 7;
  let d = new Date(Date.UTC(year, month - 1, 1 + offset));
  const result = [];
  while (d <= end) {
    result.push(new Date(d));
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
export async function GET(req) {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const year = Number(searchParams.get("year"));
    const month = Number(searchParams.get("month"));
    const professorIdsParam = searchParams.get("professorIds");

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

    // 1) Horarios vigentes para el mes (para TODOS los profes)
    let schedules = await ProfessorSchedule.find({
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

    // 2) Users (para capacidad y name)
    const users = await User.find({
      _id: { $in: professorIds },
      role: "professor",
      state: true,
    })
      .select("_id name capacity")
      .lean();
    const userById = new Map(users.map((u) => [String(u._id), u]));

    // 3) Inscripciones activas del mes para esos profes
    const enrollments = await Enrollment.find({
      professor: { $in: professorIds },
      year,
      month,
      state: "activa",
    })
      .select("professor chosenSlots")
      .lean();

    // 4) Conteo por (professor, slot)
    const counts = new Map(); // key: profId => Map(slotKey => count)
    for (const e of enrollments) {
      const pid = String(e.professor);
      if (!counts.has(pid)) counts.set(pid, new Map());
      const inner = counts.get(pid);

      for (const s of e.chosenSlots || []) {
        const k = slotKey(s, pid);
        inner.set(k, (inner.get(k) || 0) + 1);
      }
    }

    // 5) Expandir a eventos por día del mes
    const events = [];
    for (const sc of schedules) {
      const pid = String(sc.professor);
      const prof = userById.get(pid);

      const profName = prof?.name || "Professor";
      const capacity = Math.max(1, Number(prof?.capacidadPorFranja ?? 10));
      const inner = counts.get(pid) || new Map();
      for (const s of sc.slots) {
        const k = slotKey(s, pid);
        const taken = inner.get(k) || 0;
        const left = Math.max(0, capacity - taken);
        const status = left > 0 ? "available" : "full";

        const dates = datesForWeekdayInMonth(year, month, s.dayOfWeek);
        for (const day of dates) {
          events.push({
            title: `${profName} (${taken}/${capacity})`,
            start: buildDateTimeUTC(day, s.startMin),
            end: buildDateTimeUTC(day, s.endMin),
            professorId: pid,
            professorName: profName,
            slotKey: k,
            weekday: s.dayOfWeek,
            capacityLeft: left,
            status,
            _id: sc._id, // schedule ID for reference
          });
        }
      }
    }

    events.sort((a, b) => a.start - b.start);
    return NextResponse.json({ events });
  } catch (err) {
    console.error("GET /api/calendario/professores error:", err);
    return NextResponse.json(
      { error: "Error del servidor", details: err?.message },
      { status: 500 }
    );
  }
}
