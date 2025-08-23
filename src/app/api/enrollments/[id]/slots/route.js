import { NextResponse as _NR } from "next/server";
import dbConnect from "@/lib/dbConnect";
import { Enrollment, ProfessorSchedule, User } from "@/models";
import { slotKey } from "@/functions/slotKey";

export async function PATCH(req, { params }) {
  try {
    await dbConnect();
    const { id } = await params;
    const body = await req.json();
    const { chosenSlots = [], assignNow } = body || {};
    const en = await Enrollment.findById(id);
    console.log(en, "enrollment in PATCH /enrollments/[id]/slots");

    if (!en)
      return _NR.json({ error: "Inscripción no encontrada" }, { status: 404 });
    console.log(body, "body in PATCH /enrollments/[id]/slots");
    console.log(body.slots, "body in PATCH /enrollments/[id]/slots");

    if (
      !Array.isArray(chosenSlots) ||
      chosenSlots.length < 1 ||
      chosenSlots.length > 2
    )
      return _NR.json({ error: "Debés elegir 1 o 2 franjas" }, { status: 400 });

    // validar contra horario vigente del profesor para ese mes
    const start = new Date(Date.UTC(en.year, en.month - 1, 1));
    const sched = await ProfessorSchedule.findActiveForDate(
      en.professor,
      start
    );
    if (!sched)
      return _NR.json(
        { error: "Profesor sin horario vigente" },
        { status: 400 }
      );

    const setSched = new Set(
      sched.slots.map((s) => slotKey(s, sched.professor))
    );

    console.log(setSched, "setSched in PATCH /enrollments/[id]/slots");

    for (const s of chosenSlots) {
      console.log(setSched.has(slotKey(s, sched.professor)));
      
      if (!setSched.has(slotKey(s, sched.professor))) {
        return _NR.json(
          { error: "Alguna franja no existe en el horario" },
          { status: 409 }
        );
      }
    }

    // si está asignada (o si assignNow=true), validar cupo
    const prof = await User.findById(en.professor).lean();
    const capacity = Math.max(1, Number(prof?.capacity ?? 10));
    if (en.assigned || assignNow) {
      for (const s of chosenSlots) {
        const same = await Enrollment.countDocuments({
          professor: en.professor,
          year: en.year,
          month: en.month,
          state: "activa",
          assigned: true,
          chosenSlots: { $elemMatch: s },
          _id: { $ne: en._id },
        });
        if (same >= capacity)
          return _NR.json(
            { error: "Sin cupo en alguna franja", slot: s },
            { status: 409 }
          );
      }
    }

    en.chosenSlots = chosenSlots;
    await en.save();
    return _NR.json({ ok: true });
  } catch (err) {
    console.error("PATCH /enrollments/[id]/slots", err);
    return _NR.json(
      { error: "Error del servidor", details: err?.message },
      { status: 500 }
    );
  }
}
