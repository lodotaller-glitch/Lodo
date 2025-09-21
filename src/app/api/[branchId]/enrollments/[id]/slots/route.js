import { NextResponse as _NR } from "next/server";
import dbConnect from "@/lib/dbConnect";
import { Enrollment, ProfessorSchedule, User } from "@/models";
import { slotKey } from "@/functions/slotKey";

export async function PUT(req, { params }) {
  try {
    await dbConnect();
    const { id } = await params;
    const body = await req.json();
    const {
      chosenSlots = [],
      assignNow,
      professorId: bodyProfessorId,
    } = body || {};

    const en = await Enrollment.findById(id);
    if (!en)
      return _NR.json({ error: "Inscripción no encontrada" }, { status: 404 });

    if (
      !Array.isArray(chosenSlots) ||
      chosenSlots.length < 1 ||
      chosenSlots.length > 2
    ) {
      return _NR.json({ error: "Debés elegir 1 o 2 franjas" }, { status: 400 });
    }

    const targetProfessor = bodyProfessorId || en.professor;

    const monthStartUTC = new Date(Date.UTC(en.year, en.month - 1, 1));
    const sched = await ProfessorSchedule.findActiveForDate(
      targetProfessor,
      monthStartUTC
    );
    if (!sched)
      return _NR.json(
        { error: "Profesor destino sin horario vigente" },
        { status: 400 }
      );

    const valid = new Set(sched.slots.map((s) => slotKey(s, sched.professor)));

    for (const s of chosenSlots) {
      if (!valid.has(slotKey(s, targetProfessor))) {
        return _NR.json(
          {
            error: "Alguna franja no existe en el horario del profesor elegido",
          },
          { status: 409 }
        );
      }
    }

    const prof = await User.findById(targetProfessor).lean();
    const capacity = Math.max(1, Number(prof?.capacity ?? 10));
    if (en.assigned || assignNow) {
      for (const s of chosenSlots) {
        const same = await Enrollment.countDocuments({
          professor: targetProfessor,
          year: en.year,
          month: en.month,
          state: "activa",
          assigned: true,
          chosenSlots: { $elemMatch: s },
          _id: { $ne: en._id },
        });
        if (same >= capacity)
          return _NR.json(
            {
              error: "Sin cupo en alguna franja del profesor elegido",
              slot: s,
            },
            { status: 409 }
          );
      }
    }

    const professorChanged = String(en.professor) !== String(targetProfessor);
    if (professorChanged) en.professor = targetProfessor;
    en.chosenSlots = chosenSlots;

    await en.save();
    return _NR.json({ ok: true, professorChanged });
  } catch (err) {
    console.error("POST /enrollments/[id]/slots", err);
    return _NR.json(
      { error: "Error del servidor", details: err?.message },
      { status: 500 }
    );
  }
}
