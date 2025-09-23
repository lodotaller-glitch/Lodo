export const runtime = "nodejs";
import dbConnect from "@/lib/dbConnect";
import { sendNewAccountEmail } from "@/lib/mailer";
import { User, Enrollment, ProfessorSchedule } from "@/models";
import { hhmmToMin } from "@/utils/time";

const parseSlot = (body) => {
  if (body.slotKey) {
    const [id, d, s, e] = body.slotKey.split("-").map(Number);
    return { dayOfWeek: d, startMin: s, endMin: e };
  }
  if (body.slot) {
    const { dayOfWeek, start, end } = body.slot;
    return {
      dayOfWeek: Number(dayOfWeek),
      startMin: hhmmToMin(start),
      endMin: hhmmToMin(end),
    };
  }
  return null;
};

const DOW = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];
const minToHHMM = (m) => {
  const h = Math.floor(m / 60),
    mi = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
};


export async function POST(req) {
  try {
    await dbConnect();
    const body = await req.json();
    const {
      name,
      email,
      password,
      professorId,
      branch,
      assignedNow = false,
      year,
      month,
      createBy,
    } = body || {};

    if (
      !email ||
      !name ||
      !password ||
      !professorId ||
      !year ||
      !month ||
      !branch
    ) {
      return Response.json(
        { error: "Faltan campos obligatorios" },
        { status: 400 }
      );
    }

    const slot = parseSlot(body);
    if (!slot) return Response.json({ error: "Falta slot" }, { status: 400 });

    // 1) Student (alta o buscar existente)
    let wasNew = false; // <— para saber si debemos mandar el email
    let student = await User.findOne({ email: email.toLowerCase() }).lean();

    if (!student) {
      // OJO: si tenés pre-save hook de hash, guardá "password" (no hash) para que el hook lo procese.
      // Si NO tenés hook, reemplazá por el hash correcto.
      const created = await User.create({
        name,
        email: email.toLowerCase(),
        passwordHash: password, // <-- ajustá según tu modelo/hook
        branch,
        role: "student",
        state: true,
      });
      student = created.toObject();
      wasNew = true; // <—
    } else if (student.role !== "student") {
      return Response.json(
        { error: "El email ya existe y no corresponde a student" },
        { status: 409 }
      );
    }

    // 2) Validar slot contra horario vigente del profesor para el mes
    const monthStart = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
    const schedule = await ProfessorSchedule.findActiveForDate(
      professorId,
      monthStart
    );
    if (!schedule) {
      return Response.json(
        { error: "El professor no tiene horario vigente para ese mes" },
        { status: 400 }
      );
    }
    const key = (s) =>
      `${schedule.professor.toString()}-${s.dayOfWeek}-${s.startMin}-${
        s.endMin
      }`;
    const setSched = new Set(schedule.slots.map(key));
    if (!setSched.has(key(slot))) {
      return Response.json(
        {
          error:
            "La franja elegida no existe en el horario del professor para ese mes",
        },
        { status: 400 }
      );
    }

    // 3) Capacidad semanal (aprox por franja)
    const prof = await User.findById(professorId).lean();
    const capacity = Math.max(1, Number(prof?.capacity ?? 10));
    const sameSlotCount = await Enrollment.countDocuments({
      professor: professorId,
      year: Number(year),
      month: Number(month),
      estado: "activa",
      chosenSlots: { $elemMatch: slot },
    });
    if (sameSlotCount >= capacity) {
      return Response.json(
        { error: "No hay cupo en esa franja para este mes" },
        { status: 409 }
      );
    }

    let assigned = Boolean(assignedNow);
    if (assigned) {
      const sameSlotAssignedCount = await Enrollment.countDocuments({
        professor: professorId,
        year: Number(year),
        month: Number(month),
        state: "activa",
        assigned: true,
        chosenSlots: { $elemMatch: slot },
      });
      if (sameSlotAssignedCount >= capacity) {
        return Response.json(
          { error: "Sin cupo en esa franja" },
          { status: 409 }
        );
      }
    }

    // 4) Crear inscripción
    const enrollment = await Enrollment.create({
      student: student._id,
      professor: professorId,
      branch,
      year: Number(year),
      month: Number(month),
      chosenSlots: [slot],
      assigned,
      createBy: createBy || null,
    });

    await User.updateOne({ _id: student._id }, { $inc: { clayKg: 1.5 } });

    // 5) Si el usuario fue creado recién, enviamos el email de nueva cuenta
    if (wasNew) {
      const weekdayLabel = DOW[slot.dayOfWeek] || "";
      const timeRangeLabel = `${minToHHMM(slot.startMin)}–${minToHHMM(
        slot.endMin
      )}`;
      try {
        await sendNewAccountEmail(email, {
          studentName: name,
          email,
          tempPassword: password || undefined,
          professorName: prof?.name || "Profesor/a",
          weekdayLabel,
          timeRangeLabel,
          year: Number(year),
          month: Number(month),
        });
      } catch (e) {
        // No interrumpir el flujo por fallo de email
        console.error("email error", email, e?.message);
      }
    }

    return Response.json({
      ok: true,
      enrollmentId: enrollment._id,
      studentId: student._id,
      sentWelcomeEmail: wasNew, // útil para debug/cliente
    });
  } catch (err) {
    console.error("inscribir student error:", err);
    return Response.json(
      { error: "Error del servidor", details: err?.message },
      { status: 500 }
    );
  }
}
