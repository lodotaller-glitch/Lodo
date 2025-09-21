import { NextResponse as NR } from "next/server";
import dbConnect from "@/lib/dbConnect";
import {
  Enrollment,
  StudentReschedule,
  ProfessorSchedule,
  User,
} from "@/models";
import { getUserFromRequest } from "@/lib/authserver";

/** Util: arma una fecha UTC con Y/M/D y HH:MM desde minutos */
function buildUTCDate(year, month /*1-12*/, day, minutesFromMidnight) {
  const d = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  const h = Math.floor(minutesFromMidnight / 60);
  const m = minutesFromMidnight % 60;
  d.setUTCHours(h, m, 0, 0);
  return d;
}

/** Util: busca la fecha más cercana ±7 días a 'from' que tenga el DOW de slotTo */
function nearestDateForSlotAround(from, slotTo) {
  const targetDOW = Number(slotTo.dayOfWeek);
  // Normalizamos 'from' a medianoche UTC para facilitar comparaciones
  const base = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())
  );
  let best = null;
  let bestAbs = Infinity;

  for (let delta = -7; delta <= 7; delta++) {
    const cand = new Date(base);
    cand.setUTCDate(cand.getUTCDate() + delta);
    if (cand.getUTCDay() !== targetDOW) continue;

    // Seteamos hora del slot
    const candWithTime = buildUTCDate(
      cand.getUTCFullYear(),
      cand.getUTCMonth() + 1,
      cand.getUTCDate(),
      slotTo.startMin
    );

    const abs = Math.abs(candWithTime - from);
    if (abs < bestAbs) {
      best = candWithTime;
      bestAbs = abs;
    }
  }
  // fallback: si por alguna razón no matcheó, devolvemos 'from'
  return best || new Date(from);
}

export async function POST(req, { params }) {
  try {
    await dbConnect();
    const actor = await getUserFromRequest(req); // { id, role } | null

    const body = await req.json();
    // Acepto alias para compatibilidad
    const enrollmentId = body.enrollmentId;
    const fromDate = body.fromDate || body.fromDateISO;
    const toDate = body.toDate || body.toDateISO || null;
    const slotTo = body.slotTo || body.toSlot;
    const motivo = body.motivo || body.reason || "";
    const toProfessorId = body.toProfessorId || body.professorId || null;
    const slotFromBody = body.slotFrom || body.fromSlot || null;

    const { branchId } = await params;

    if (!enrollmentId || !fromDate || !slotTo) {
      return NR.json({ error: "Faltan parámetros" }, { status: 400 });
    }

    const en = await Enrollment.findById(enrollmentId).lean();
    if (!en)
      return NR.json({ error: "Inscripción no encontrada" }, { status: 404 });

    const from = new Date(fromDate);
    if (Number.isNaN(+from))
      return NR.json({ error: "fromDate inválida" }, { status: 400 });

    const year = from.getUTCFullYear();
    const month = from.getUTCMonth() + 1;

    // Limitar a 1 por (enrollment, año, mes)
    const existing = await StudentReschedule.findOne({
      enrollment: en._id,
      year,
      month,
    }).lean();
    if (actor?.role === "student" && existing) {
      return NR.json(
        { error: "Solo podés reprogramar una clase por mes." },
        { status: 403 }
      );
    }

    // Validar ventana ±7 días si viene toDate explícito
    let toFinal = toDate ? new Date(toDate) : null;
    if (toFinal) {
      const diffDays = (toFinal - from) / (1000 * 60 * 60 * 24);
      if (diffDays < 0 || diffDays > 7.0001) {
        return NR.json({ error: "Debe ser dentro de 7 días" }, { status: 400 });
      }
    } else {
      // Si no viene toDate, deducimos una fecha cercana coherente con el DOW del slot
      toFinal = nearestDateForSlotAround(from, slotTo);
    }

    // Validar que slotTo exista en el horario del profesor destino para ese mes
    const fromProfessor = en.professor || en.profesor;
    const toProfessor = toProfessorId || fromProfessor;

    const sched = await ProfessorSchedule.findActiveForDate(
      toProfessor,
      new Date(Date.UTC(year, month - 1, 1))
    ); // ojo: NO usar .lean() si findActiveForDate ya resuelve
    if (!sched) {
      return NR.json(
        { error: "El profesor no tiene horario vigente" },
        { status: 400 }
      );
    }

    const key = (s) => `${s.dayOfWeek}-${s.startMin}-${s.endMin}`;
    const setSched = new Set((sched.slots || []).map(key));
    if (!setSched.has(key(slotTo))) {
      return NR.json(
        { error: "La franja destino no existe en ese mes" },
        { status: 400 }
      );
    }

    // Cupo (acepta español/inglés)
    const profDoc = await User.findById(toProfessor).lean();
    const capacity = Math.max(1, Number(profDoc?.capacity ?? 10));
    const cupoQuery = {
      professor: toProfessor,
      year,
      month,
      chosenSlots: { $elemMatch: slotTo },
      $and: [
        { $or: [{ estado: "activa" }, { state: "activa" }] },
        { $or: [{ asignado: true }, { assigned: true }] },
      ],
    };
    const same = await Enrollment.countDocuments(cupoQuery);
    if (same >= capacity) {
      return NR.json({ error: "Sin cupo en esa franja" }, { status: 409 });
    }

    // Determinar slotFrom desde la fecha 'from'
    const dow = from.getUTCDay();
    const startMin = from.getUTCHours() * 60 + from.getUTCMinutes();
    const slotFromInfer = (en.chosenSlots || []).find(
      (s) => s.dayOfWeek === dow && s.startMin === startMin
    );
    const slotFromFinal = slotFromBody;

    const baseUpdate = {
      enrollment: en._id,
      student: en.student || en.estudiante,
      fromProfessor,
      toProfessor,
      professor: toProfessor, // compat con código legado
      year,
      month,
      branch: branchId,
      fromDate: from,
      toDate: toFinal,
      slotFrom: slotFromFinal,
      slotTo,
      motivo,
      updatedAt: new Date(),
      // createBy: actor?.id || null,
    };

    // Si ya existe y NO es student, actualizamos; si no existe, creamos.
    if (existing && actor?.role !== "student") {
      const updated = await StudentReschedule.findOneAndUpdate(
        { _id: existing._id },
        { $set: baseUpdate },
        { new: true }
      ).lean();
      return NR.json({ ok: true, rescheduleId: updated._id, updated: true });
    }

    try {
      const created = await StudentReschedule.create({
        ...baseUpdate,
        createdAt: new Date(),
      });
      return NR.json(
        { ok: true, rescheduleId: created._id, created: true },
        { status: 201 }
      );
    } catch (e) {
      // Carrera: si chocó el índice único, hacemos update
      if (e?.code === 11000) {
        const doc = await StudentReschedule.findOneAndUpdate(
          { enrollment: en._id, year, month },
          { $set: baseUpdate },
          { new: true }
        ).lean();

        if (actor?.role === "student") {
          return NR.json(
            {
              error: "Ya existe una reprogramación para este mes",
              rescheduleId: doc?._id,
            },
            { status: 403 }
          );
        }
        return NR.json({ ok: true, rescheduleId: doc?._id, updated: true });
      }
      throw e;
    }
  } catch (err) {
    console.error("POST /enrollments/student-reschedules", err);
    return NR.json(
      { error: "Error del servidor", details: err?.message },
      { status: 500 }
    );
  }
}
