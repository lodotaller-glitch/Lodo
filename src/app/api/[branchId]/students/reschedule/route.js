import dbConnect from "@/lib/dbConnect";
import {
  Enrollment,
  ProfessorSchedule,
  StudentReschedule,
  User,
} from "@/models";

function startOfMonthUTC(y, m) {
  return new Date(Date.UTC(y, m - 1, 1));
}
function endOfMonthUTC(y, m) {
  return new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
}

function minutesFromDateUTC(d) {
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

export async function POST(req) {
  try {
    await dbConnect();
    const body = await req.json();
    const { enrollmentId, fromISO, toISO, motivo, creadoPor } = body || {};
    if (!enrollmentId || !fromISO || !toISO) {
      return Response.json({ error: "Faltan campos" }, { status: 400 });
    }
    const fromDate = new Date(fromISO);
    const toDate = new Date(toISO);
    if (isNaN(fromDate) || isNaN(toDate))
      return Response.json({ error: "Fechas inválidas" }, { status: 400 });

    // 1) Traer inscripción y validar 1 slot semanal
    const en = await Enrollment.findById(enrollmentId).lean();
    if (!en || en.state !== "activa")
      return Response.json(
        { error: "Inscripción no encontrada/activa" },
        { status: 404 }
      );
    if (!en.chosenSlots?.length || en.chosenSlots.length > 2) {
      return Response.json({ error: "Inscripción inválida" }, { status: 400 });
    }
    // Regla del negocio: 1 clase por semana => tomamos el primer slot
    const baseSlot = en.chosenSlots[0];
    const y = en.year,
      m = en.month;

    // 2) Mismo mes/año
    const inMonth = (d) =>
      d >= startOfMonthUTC(y, m) && d <= endOfMonthUTC(y, m);
    if (!inMonth(fromDate) || !inMonth(toDate)) {
      return Response.json(
        { error: "Las fechas deben pertenecer al mismo mes de la inscripción" },
        { status: 400 }
      );
    }

    // 3) Validar que fromDate sea una ocurrencia del slot base
    const fromDow = fromDate.getUTCDay();
    const fromMin = minutesFromDateUTC(fromDate);
    if (fromDow !== baseSlot.dayOfWeek || fromMin !== baseSlot.startMin) {
      return Response.json(
        { error: "fromDate no coincide con el horario habitual del alumno" },
        { status: 400 }
      );
    }

    // 4) Validar que toDate coincida con un slot del professor vigente ese mes
    const schedule = await ProfessorSchedule.findActiveForDate(
      en.professor,
      startOfMonthUTC(y, m)
    );
    if (!schedule)
      return Response.json(
        { error: "El professor no tiene horario vigente para ese mes" },
        { status: 400 }
      );

    const toDow = toDate.getUTCDay();
    const toMin = minutesFromDateUTC(toDate);
    const slotTo = schedule.slots.find(
      (s) => s.dayOfWeek === toDow && s.startMin === toMin
    );
    if (!slotTo)
      return Response.json(
        { error: "toDate no es una franja válida del professor" },
        { status: 400 }
      );

    // 5) Chequear que no haya ya una reprogramación para esta inscripción en el mes
    const exists = await StudentReschedule.findOne({
      enrollment: en._id,
      year: y,
      month: m,
    }).lean();
    if (exists)
      return Response.json(
        { error: "Ya usó la reprogramación de este mes" },
        { status: 409 }
      );

    // 6) Capacidad por ocurrencia (toDate)
    const prof = await User.findById(en.professor).lean();
    const capacity = Math.max(1, Number(prof?.capacity ?? 10));

    // base: cantidad de inscripciones con ese slot
    const baseCount = await Enrollment.countDocuments({
      professor: en.professor,
      year: y,
      month: m,
      state: "activa",
      chosenSlots: {
        $elemMatch: {
          dayOfWeek: slotTo.dayOfWeek,
          startMin: slotTo.startMin,
          endMin: slotTo.endMin,
        },
      },
    });

    // ajustes por reprogramaciones existentes
    const incoming = await StudentReschedule.countDocuments({
      professor: en.professor,
      year: y,
      month: m,
      toDate,
    });
    const outgoing = await StudentReschedule.countDocuments({
      professor: en.professor,
      year: y,
      month: m,
      fromDate: toDate,
    });
    const occupancy = baseCount + incoming - outgoing;

    if (occupancy >= capacity) {
      return Response.json(
        { error: "No hay cupo en esa fecha/horario" },
        { status: 409 }
      );
    }

    // 7) Guardar reprogramación
    const resch = await StudentReschedule.create({
      enrollment: en._id,
      student: en.student,
      professor: en.professor,
      year: y,
      month: m,
      fromDate,
      toDate,
      slotFrom: baseSlot,
      slotTo: {
        dayOfWeek: slotTo.dayOfWeek,
        startMin: slotTo.startMin,
        endMin: slotTo.endMin,
      },
      motivo: motivo || "",
      creadoPor: creadoPor || null,
    });

    return Response.json({ ok: true, rescheduleId: resch._id });
  } catch (err) {
    console.error("reprogramar error:", err);
    return Response.json(
      { error: "Error del servidor", details: err?.message },
      { status: 500 }
    );
  }
}
