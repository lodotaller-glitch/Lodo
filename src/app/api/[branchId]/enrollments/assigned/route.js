import { NextResponse } from "next/server";
import { Enrollment, ProfessorSchedule, User } from "@/models";
import dbConnect from "@/lib/dbConnect";

export async function POST(req) {
  try {
    await dbConnect();
    const { enrollmentId } = await req.json();
    if (!enrollmentId)
      return NextResponse.json(
        { error: "Falta enrollmentId" },
        { status: 400 }
      );

    const en = await Enrollment.findById(enrollmentId);
    if (!en || en.state !== "activa")
      return NextResponse.json(
        { error: "Inscripción no encontrada/activa" },
        { status: 404 }
      );
    if (en.assigned) return NextResponse.json({ ok: true, already: true });
    

    // validar que la/s franja/s existen aún en el mes
    const monthStart = new Date(Date.UTC(en.year, en.month - 1, 1));
    const sched = await ProfessorSchedule.findActiveForDate(
      en.professor,
      monthStart
    );
    if (!sched)
      return NextResponse.json(
        { error: "Profesor sin horario vigente en ese mes" },
        { status: 400 }
      );
    const key = (s) => `${s.dayOfWeek}-${s.startMin}-${s.endMin}`;
    const setSched = new Set(sched.slots.map(key));
    for (const s of en.chosenSlots) {
      if (!setSched.has(key(s)))
        return NextResponse.json(
          { error: "Alguna franja ya no existe en el horario" },
          { status: 409 }
        );
    }

    // cupo por franja
    const prof = await User.findById(en.professor).lean();
    const capacity = Math.max(1, Number(prof?.capacity ?? 10));
    for (const s of en.chosenSlots) {
      const same = await Enrollment.countDocuments({
        professor: en.professor,
        year: en.year,
        month: en.month,
        state: "activa",
        assigned: true,
        chosenSlots: { $elemMatch: s },
      });
      if (same >= capacity)
        return NextResponse.json(
          { error: "Sin cupo en alguna franja", slot: s },
          { status: 409 }
        );
    }

    en.assigned = true;
    await en.save();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /assigned error:", err);
    return NextResponse.json(
      { error: "Error del servidor", details: err?.message },
      { status: 500 }
    );
  }
}
