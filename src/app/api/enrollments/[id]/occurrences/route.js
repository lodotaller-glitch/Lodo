import { NextResponse as ___NR } from "next/server";
import dbConnect from "@/lib/dbConnect";
import { Enrollment } from "@/models";

function* iterMonthOccurrences(year, month, slot) {
  // month: 1..12 ; slot: {dayOfWeek,startMin,endMin}
  const first = new Date(Date.UTC(year, month - 1, 1));
  const last = new Date(Date.UTC(year, month, 0)); // último día
  // encontrar primer díaOfWeek en el mes
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
    const list = [];
    for (const s of en.chosenSlots) {
      for (const occ of iterMonthOccurrences(en.year, en.month, s)) {
        list.push({
          start: occ.start.toISOString(),
          end: occ.end.toISOString(),
          slot: s,
        });
      }
    }
    list.sort((a, b) => new Date(a.start) - new Date(b.start));
    return ___NR.json({ occurrences: list });
  } catch (err) {
    console.error("GET /enrollments/[id]/occurrences", err);
    return ___NR.json({ error: "Error del servidor" }, { status: 500 });
  }
}
