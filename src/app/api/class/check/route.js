import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import {
  Attendance,
  Enrollment,
  User,
  StudentReschedule,
  ProfessorSchedule,
} from "@/models";
import { getUserFromRequest } from "@/lib/authserver";

// "profId-dow-startMin-endMin"
function parseSlot(slot) {
  const [professorId, dayOfWeek, startMin, endMin] = String(slot)
    .split("-")
    .map(String);
  return {
    professorId,
    dayOfWeek: Number(dayOfWeek),
    startMin: Number(startMin),
    endMin: Number(endMin),
  };
}

function decodeKey(k) {
  const b64 = k.replace(/-/g, "+").replace(/_/g, "/");
  const json = Buffer.from(b64, "base64").toString("utf8");
  return JSON.parse(json);
}

const sameSlot = (a, b) =>
  a &&
  b &&
  Number(a.dayOfWeek) === Number(b.dayOfWeek) &&
  Number(a.startMin) === Number(b.startMin) &&
  Number(a.endMin) === Number(b.endMin);

function monthAnchorUTC(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}

function buildSlotSnapshot(slot) {
  return {
    professorId: String(slot.professorId),
    dayOfWeek: slot.dayOfWeek,
    startMin: slot.startMin,
    endMin: slot.endMin,
  };
}

async function handleCheck({ req, payload }) {
  await dbConnect();

  // Debe estar logueado como estudiante
  const actor = await getUserFromRequest(req);
  if (!actor?._id) {
    return new NextResponse("No autenticado", {
      status: 401,
      headers: { "content-type": "text/plain" },
    });
  }

  // Payload: { b, st, sl, e? }
  const branchId = String(payload.b || "");
  const startDate = new Date(payload.st);
  const slot = parseSlot(payload.sl || "");
  if (!branchId || Number.isNaN(+startDate) || !slot.professorId) {
    return new NextResponse("classKey inválido", {
      status: 400,
      headers: { "content-type": "text/plain" },
    });
  }

  // Ventana de check-in (−15 min / +3 h)
  const now = Date.now();
  const startsAt = +startDate;
  const OPEN_OFFSET_MS = (2 * 60 + 45) * 60 * 1000;

  if (now < startsAt + OPEN_OFFSET_MS || now > startsAt + 6 * 60 * 60 * 1000) {
    return new NextResponse("Fuera de ventana de check-in", {
      status: 403,
      headers: { "content-type": "text/plain" },
    });
  }

  // Alumno
  const student = await User.findById(actor._id).select("_id").lean();
  if (!student) {
    return new NextResponse("Alumno no encontrado", {
      status: 404,
      headers: { "content-type": "text/plain" },
    });
  }

  const y = startDate.getUTCFullYear();
  const m = startDate.getUTCMonth() + 1;

  // ------------------------------------------------------------------
  // A) CLASE PROGRAMADA EN ATTENDANCE (gana prioridad)
  //    Si ya existe un Attendance para esa fecha, alumno, profe, sede
  //    (origin puede ser "regular" o "adhoc"), lo marcamos presente.
  // ------------------------------------------------------------------
  const preScheduled = await Attendance.findOne({
    student: student._id,
    professor: slot.professorId,
    branch: branchId,
    date: startDate, // asegúrate de guardar 'date' al inicio exacto en UTC
    removed: { $ne: true },
  })
    .select("_id enrollment origin")
    .lean();

  const slotSnapshot = buildSlotSnapshot(slot);

  if (preScheduled) {
    const update = {
      $set: {
        status: "presente",
        markedBy: actor._id,
        markedAt: new Date(),
      },
      $unset: { notes: "" },
    };
    // Sólo seteamos slotSnapshot si no existe aún para no pisar históricos
    if (!preScheduled.slotSnapshot) {
      update.$set.slotSnapshot = slotSnapshot;
    }

    await Attendance.updateOne({ _id: preScheduled._id }, update);
    return new NextResponse("OK (programada)", {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
  }

  // (Opcional) Verificar que el slot exista en el horario vigente del profe ese mes
  // Evita aceptar QR de slots inexistentes cuando NO hay Attendance pre-creado.
  const sched = await ProfessorSchedule.findActiveForDate(
    slot.professorId,
    monthAnchorUTC(startDate)
  );
  if (!sched || !(sched.slots || []).some((s) => sameSlot(s, slot))) {
    return new NextResponse("La franja no existe en el horario vigente", {
      status: 400,
      headers: { "content-type": "text/plain" },
    });
  }

  // ------------------------------------------------------------------
  // B) ENROLLMENT REGULAR
  // ------------------------------------------------------------------
  const enrollment = await Enrollment.findOne({
    student: student._id,
    branch: branchId,
    professor: slot.professorId,
    year: y,
    month: m,
    $or: [{ state: "activa" }, { estado: "activa" }],
    $or: [{ assigned: true }, { asignado: true }],
    chosenSlots: {
      $elemMatch: {
        dayOfWeek: slot.dayOfWeek,
        startMin: slot.startMin,
        endMin: slot.endMin,
      },
    },
  })
    .select("_id student")
    .lean();

  if (enrollment) {
    await Attendance.findOneAndUpdate(
      { enrollment: enrollment._id, date: startDate },
      {
        enrollment: enrollment._id,
        student: enrollment.student,
        professor: slot.professorId,
        branch: branchId,
        date: startDate,
        status: "presente",
        origin: "regular",
        removed: false,
        slotSnapshot,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return new NextResponse("OK (regular)", {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
  }

  // ------------------------------------------------------------------
  // C) REPROGRAMACIÓN EXACTA (toDate)
  // ------------------------------------------------------------------
  const resch = await StudentReschedule.findOne({
    student: student._id,
    branch: branchId,
    year: y,
    month: m,
    $or: [{ toProfessor: slot.professorId }, { professor: slot.professorId }],
    "slotTo.dayOfWeek": slot.dayOfWeek,
    "slotTo.startMin": slot.startMin,
    "slotTo.endMin": slot.endMin,
    toDate: startDate,
  })
    .select("_id enrollment student")
    .lean();

  if (resch) {
    await Attendance.findOneAndUpdate(
      { enrollment: resch.enrollment, date: startDate },
      {
        enrollment: resch.enrollment,
        student: resch.student,
        professor: slot.professorId,
        branch: branchId,
        date: startDate,
        status: "presente",
        origin: "regular",
        reschedule: resch._id,
        removed: false,
        slotSnapshot,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return new NextResponse("OK (reprogramada)", {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
  }

  // ------------------------------------------------------------------
  // D) No habilitado
  // ------------------------------------------------------------------
  return new NextResponse("No estás inscripto en esta clase", {
    status: 403,
    headers: { "content-type": "text/plain" },
  });
}

// GET: /api/class/check?k=BASE64URL
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const k = searchParams.get("k");
    if (!k)
      return new NextResponse("Falta k", {
        status: 400,
        headers: { "content-type": "text/plain" },
      });
    const payload = decodeKey(k);
    return await handleCheck({ req, payload });
  } catch (err) {
    console.error("GET /api/class/check", err);
    return new NextResponse("Error del servidor", {
      status: 500,
      headers: { "content-type": "text/plain" },
    });
  }
}

// POST: body { classKey }
export async function POST(req) {
  try {
    const { classKey } = await req.json();
    if (!classKey)
      return NextResponse.json({ error: "Falta classKey" }, { status: 400 });
    const payload = decodeKey(classKey);
    const res = await handleCheck({ req, payload });
    return NextResponse.json(
      { ok: res.status === 200, message: await res.text() },
      { status: res.status }
    );
  } catch (err) {
    console.error("POST /api/class/check", err);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}
