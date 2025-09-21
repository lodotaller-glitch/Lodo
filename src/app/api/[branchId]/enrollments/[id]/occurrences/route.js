import { NextResponse as ___NR } from "next/server";
import dbConnect from "@/lib/dbConnect";
import { Enrollment, StudentReschedule, Attendance } from "@/models"; // 👈 sumar Attendance

// --- helpers ---
function* iterMonthOccurrences(year, month, slot) {
  // month: 1..12 ; slot.dayOfWeek: 0..6 (0=Dom)
  const first = new Date(Date.UTC(year, month - 1, 1));
  const last = new Date(Date.UTC(year, month, 0));

  let d = new Date(first);
  const offset = (slot.dayOfWeek - d.getUTCDay() + 7) % 7;
  d.setUTCDate(d.getUTCDate() + offset);

  // Igual que tu datesForWeekdayInMonth:
  //  - si es domingo (0) no limitamos
  //  - para el resto, como mucho 4 ocurrencias
  const limit = slot.dayOfWeek === 0 ? Infinity : 4;
  let count = 0;

  while (d <= last && count < limit) {
    const start = new Date(
      Date.UTC(
        d.getUTCFullYear(),
        d.getUTCMonth(),
        d.getUTCDate(),
        Math.floor(slot.startMin / 60),
        slot.startMin % 60
      )
    );
    const end = new Date(
      Date.UTC(
        d.getUTCFullYear(),
        d.getUTCMonth(),
        d.getUTCDate(),
        Math.floor(slot.endMin / 60),
        slot.endMin % 60
      )
    );

    yield { start, end };
    count += 1;
    d.setUTCDate(d.getUTCDate() + 7);
  }
}
function ymd(d) {
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, day: d.getUTCDate() };
}
function dateOnlyISO(d) {
  const only = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
  return only.toISOString();
}
function inMonth(date, year, month) {
  const { y, m } = ymd(date);
  return y === year && m === month;
}
function buildDateTimeUTCFromYMD(y, m, day, minutesFromMidnight) {
  const h = Math.floor(minutesFromMidnight / 60);
  const mi = minutesFromMidnight % 60;
  return new Date(Date.UTC(y, m - 1, day, h, mi, 0, 0));
}
function startOfMonthUTC(year, month) {
  return new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
}
function endOfMonthUTC(year, month) {
  return new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
}

export async function GET(_req, { params }) {
  try {
    await dbConnect();
    const { id } = await params;

    const en = await Enrollment.findById(id).lean();
    if (!en)
      return ___NR.json(
        { error: "Inscripción no encontrada" },
        { status: 404 }
      );

    const { year, month } = en;
    const enrollmentId = String(en._id);
    const professorId = String(en.professor || "");
    const branchId = String(en.branch || "");

    const monthStart = startOfMonthUTC(year, month);
    const monthEnd = endOfMonthUTC(year, month); // 👈 límite superior para ad-hoc

    // 1) Ocurrencias base
    const base = [];
    for (const s of en.chosenSlots || []) {
      for (const occ of iterMonthOccurrences(year, month, s)) {
        base.push({
          start: occ.start.toISOString(),
          end: occ.end.toISOString(),
          slot: s,
          origin: "base",
        });
      }
    }

    // 2) Reprogramaciones relacionadas
    const reschedules = await StudentReschedule.find({
      $or: [
        { enrollment: enrollmentId },
        ...(en.student
          ? [
              {
                student: en.student,
                $or: [
                  { fromProfessor: professorId },
                  { toProfessor: professorId },
                  { professor: professorId },
                ],
                year,
                month,
              },
            ]
          : []),
      ],
    }).lean();

    // 3) MovedOut / MovedIn
    const outKeys = new Set();
    const movedIn = [];
    for (const r of reschedules) {
      // OUT
      if (r.fromDate && r.slotFrom) {
        const fd = new Date(r.fromDate);
        if (inMonth(fd, year, month)) {
          const dateIso = dateOnlyISO(fd);
          outKeys.add(`${dateIso}|${r.slotFrom.startMin}|${r.slotFrom.endMin}`);
        }
      }
      // IN
      if (r.toDate && r.slotTo) {
        const td = new Date(r.toDate);
        if (inMonth(td, year, month)) {
          const { y, m, day } = ymd(td);
          const start = buildDateTimeUTCFromYMD(y, m, day, r.slotTo.startMin);
          const end = buildDateTimeUTCFromYMD(y, m, day, r.slotTo.endMin);
          movedIn.push({
            start: start.toISOString(),
            end: end.toISOString(),
            slot: r.slotTo,
            origin: "reschedule-in",
            rescheduleRef: {
              _id: String(r._id),
              fromDate: r.fromDate
                ? new Date(r.fromDate).toISOString()
                : undefined,
              toDate: new Date(r.toDate).toISOString(),
            },
          });
        }
      }
    }

    // 3.5) 👈 AD-HOC de este alumno/prof/branch en el mes
    const adhocDocs = await Attendance.find({
      origin: "adhoc",
      student: en.student,
      // professor: en.professor,
      // branch: en.branch,
      date: { $gte: monthStart, $lte: monthEnd },
      removed: { $ne: true },
    })
      .select("_id date slotSnapshot status")
      .lean();

    const adhocIn = [];
    for (const a of adhocDocs) {
      if (!a.slotSnapshot) continue;
      const td = new Date(a.date);
      if (!inMonth(td, year, month)) continue;
      const { y, m, day } = ymd(td);
      const start = buildDateTimeUTCFromYMD(y, m, day, a.slotSnapshot.startMin);
      const end = buildDateTimeUTCFromYMD(y, m, day, a.slotSnapshot.endMin);
      adhocIn.push({
        start: start.toISOString(),
        end: end.toISOString(),
        slot: a.slotSnapshot,
        origin: "adhoc",
        attendanceRef: { _id: String(a._id), status: a.status },
      });
    }

    // 4) Filtrar base según OUT
    const baseFiltered = base.filter((occ) => {
      const key = `${dateOnlyISO(new Date(occ.start))}|${occ.slot.startMin}|${
        occ.slot.endMin
      }`;
      return !outKeys.has(key);
    });

    // 5) Combinar con prioridad (reschedule-in > adhoc > base) y deduplicar por día+minutos
    const priority = { "reschedule-in": 3, adhoc: 2, base: 1 };
    const byKey = new Map(); // key => occ

    function keyOf(o) {
      const dIso = dateOnlyISO(new Date(o.start));
      return `${dIso}|${o.slot.startMin}|${o.slot.endMin}`;
    }
    function put(o) {
      const k = keyOf(o);
      const cur = byKey.get(k);
      if (!cur || priority[o.origin] > priority[cur.origin]) {
        byKey.set(k, o);
      }
    }

    for (const o of baseFiltered) put(o);
    for (const o of adhocIn) put(o); // 👈 sumar ad-hoc
    for (const o of movedIn) put(o); // 👈 y reprogramaciones IN tienen más prioridad

    const list = Array.from(byKey.values()).sort(
      (a, b) => new Date(a.start) - new Date(b.start)
    );

    return ___NR.json({ occurrences: list });
  } catch (err) {
    console.error("GET /enrollments/[id]/occurrences", err);
    return ___NR.json({ error: "Error del servidor" }, { status: 500 });
  }
}
