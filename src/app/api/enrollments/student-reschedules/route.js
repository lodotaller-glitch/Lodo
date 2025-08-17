import { NextResponse as NR } from "next/server";
import dbConnect from "@/lib/dbConnect";
import {
  Enrollment,
  StudentReschedule,
  ProfessorSchedule,
  User,
} from "@/models";
import { getUserFromRequest } from "@/lib/authserver"; // TODO: implementá según tu auth

export async function POST(req) {
  try {
    await dbConnect();
    const actor = await getUserFromRequest(req); // { id, role }
    const { enrollmentId, fromDate, toDate, slotTo, motivo, toProfessorId } =
      await req.json();
    if (!enrollmentId || !fromDate || !slotTo)
      return NR.json({ error: "Faltan parámetros" }, { status: 400 });

    const en = await Enrollment.findById(enrollmentId).lean();
    if (!en)
      return NR.json({ error: "Inscripción no encontrada" }, { status: 404 });

    const from = new Date(fromDate);
    const year = from.getUTCFullYear();
    const month = from.getUTCMonth() + 1;

    // Límite: estudiante solo 1 por (enrollment, año, mes)
    if (actor?.role === "student") {
      const count = await StudentReschedule.countDocuments({
        enrollment: en._id,
        year,
        month,
      });
      if (count >= 1)
        return NR.json(
          { error: "Solo podés reprogramar una clase por mes." },
          { status: 403 }
        );
    }

    // Validar ventana ±7 si toDate viene (opcional, o calculalo del slot)
    if (toDate) {
      const to = new Date(toDate);
      const diffDays = (to - from) / (1000 * 60 * 60 * 24);
      if (diffDays < 0 || diffDays > 7.0001)
        return NR.json({ error: "Debe ser dentro de 7 días" }, { status: 400 });
    }

    // Validar que slotTo exista en horario del profesor destino y cupo
    const professor = toProfessorId || en.professor || en.profesor;
    const sched = await ProfessorSchedule.findActiveForDate(
      professor,
      new Date(Date.UTC(year, month - 1, 1))
    ).lean();
    if (!sched)
      return NR.json(
        { error: "El profesor no tiene horario vigente" },
        { status: 400 }
      );
    const key = (s) => `${s.dayOfWeek}-${s.startMin}-${s.endMin}`;
    const setSched = new Set(sched.slots.map(key));
    if (!setSched.has(key(slotTo)))
      return NR.json(
        { error: "La franja destino no existe en ese mes" },
        { status: 400 }
      );

    // Cupo
    const profDoc = await User.findById(professor).lean();
    const capacity = Math.max(1, Number(profDoc?.capacidadPorFranja ?? 10));
    const same = await Enrollment.countDocuments({
      professor,
      year,
      month,
      estado: "activa",
      asignado: true,
      chosenSlots: { $elemMatch: slotTo },
    });
    if (same >= capacity)
      return NR.json({ error: "Sin cupo en esa franja" }, { status: 409 });

    // Determinar slotFrom desde fromDate
    const dow = from.getUTCDay();
    const startMin = from.getUTCHours() * 60 + from.getUTCMinutes();
    const slotFrom =
      (en.chosenSlots || en.slotsElegidos || []).find(
        (s) => s.dayOfWeek === dow && s.startMin === startMin
      ) || null;

    const doc = await StudentReschedule.create({
      enrollment: en._id,
      student: en.student || en.estudiante,
      proffesor: professor, // OJO: campo en tu modelo
      year,
      month,
      fromDate: from,
      toDate: toDate ? new Date(toDate) : from, // o calculalo según slotTo y fecha elegida
      slotFrom,
      slotTo,
      motivo: motivo || "",
      createBy: actor?.id || null,
    });

    return NR.json({ ok: true, rescheduleId: doc._id });
  } catch (err) {
    console.error("POST /student-reschedules", err);
    return NR.json(
      { error: "Error del servidor", details: err?.message },
      { status: 500 }
    );
  }
}
