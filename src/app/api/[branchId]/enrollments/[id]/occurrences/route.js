import { NextResponse as ___NR } from "next/server";
import dbConnect from "@/lib/dbConnect";
import { Enrollment, StudentReschedule } from "@/models";

// --- helpers ---
function* iterMonthOccurrences(year, month, slot) {
  // month: 1..12 ; slot: {dayOfWeek,startMin,endMin}
  const first = new Date(Date.UTC(year, month - 1, 1));
  const last = new Date(Date.UTC(year, month, 0)); // último día del mes
  // encontrar primer dayOfWeek en el mes
  let d = new Date(first);
  const offset = (slot.dayOfWeek - d.getUTCDay() + 7) % 7;
  d.setUTCDate(d.getUTCDate() + offset);
  while (d <= last) {
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

    // 4) Filtrar base según OUT
    const baseFiltered = base.filter((occ) => {
      const key = `${dateOnlyISO(new Date(occ.start))}|${occ.slot.startMin}|${
        occ.slot.endMin
      }`;
      return !outKeys.has(key);
    });

    // 5) Combinar y ordenar
    const list = [...baseFiltered, ...movedIn].sort(
      (a, b) => new Date(a.start) - new Date(b.start)
    );

    return ___NR.json({ occurrences: list });
  } catch (err) {
    console.error("GET /enrollments/[id]/occurrences", err);
    return ___NR.json({ error: "Error del servidor" }, { status: 500 });
  }
}
