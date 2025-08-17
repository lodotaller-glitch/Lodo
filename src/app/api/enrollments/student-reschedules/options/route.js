import { NextResponse as ____NR } from "next/server";
import dbConnect from "@/lib/dbConnect";
import { Enrollment, ProfessorSchedule } from "@/models";

export async function GET(req) {
  try {
    await dbConnect();
    const url = new URL(req.url);
    const enrollmentId = url.searchParams.get("enrollmentId");
    const from = url.searchParams.get("from");
    if (!enrollmentId || !from)
      return ____NR.json({ error: "Faltan parámetros" }, { status: 400 });
    const en = await Enrollment.findById(enrollmentId).lean();
    if (!en)
      return ____NR.json(
        { error: "Inscripción no encontrada" },
        { status: 404 }
      );

    const fromDate = new Date(from);
    const windowEnd = new Date(fromDate);
    windowEnd.setUTCDate(windowEnd.getUTCDate() + 7);

    // schedule activo para cada día del rango
    const days = [];
    const iter = new Date(fromDate);
    while (iter <= windowEnd) {
      const sched = await ProfessorSchedule.findActiveForDate(
        en.professor,
        new Date(Date.UTC(iter.getUTCFullYear(), iter.getUTCMonth(), 1))
      );
      if (sched) {
        for (const s of sched.slots) {
          // construir ocurrencia concreta para ese día si coincide dayOfWeek
          if (s.dayOfWeek === iter.getUTCDay()) {
            const start = new Date(
              Date.UTC(
                iter.getUTCFullYear(),
                iter.getUTCMonth(),
                iter.getUTCDate(),
                Math.floor(s.startMin / 60),
                s.startMin % 60
              )
            );
            const end = new Date(
              Date.UTC(
                iter.getUTCFullYear(),
                iter.getUTCMonth(),
                iter.getUTCDate(),
                Math.floor(s.endMin / 60),
                s.endMin % 60
              )
            );
            days.push({
              to: start.toISOString(),
              endISO: end.toISOString(),
              slotTo: s,
            });
          }
        }
      }
      iter.setUTCDate(iter.getUTCDate() + 1);
    }

    // capacidad por cada candidato
    const results = [];
    for (const d of days) {
      // contar asignados con ese mismo slot en ese mes
      const y = new Date(d.to).getUTCFullYear();
      const m = new Date(d.to).getUTCMonth() + 1;
      const same = await Enrollment.countDocuments({
        professor: en.professor,
        year: y,
        month: m,
        state: "activa",
        assigned: true,
        chosenSlots: { $elemMatch: d.slotTo },
      });
      const capacity = 10; // si querés, buscar capacity del profe como antes
      const capacityLeft = Math.max(0, capacity - same);
      results.push({
        ...d,
        capacityLeft,
        status: capacityLeft > 0 ? "available" : "full",
      });
    }

    return ____NR.json({ options: results });
  } catch (err) {
    console.error("GET /student-reschedules/options", err);
    return ____NR.json({ error: "Error del servidor" }, { status: 500 });
  }
}
