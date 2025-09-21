import { NextResponse } from "next/server";
import { User, ProfessorSchedule } from "@/models";
import { hhmmToMin } from "@/utils/time";
import dbConnect from "@/lib/dbConnect";

export async function POST(req) {
  try {
    await dbConnect();
    const body = await req.json();
    const {
      name,
      email,
      password,
      branch,
      capacity, // opcional
      effectiveMonth, // string "YYYY-MM" (p.ej. "2025-09")
      slots = [], // [{dayOfWeek, start, end}] con start/end "HH:mm"
      creadoPor, // opcional: _id del admin o 'redes' que hace la acción
    } = body || {};

    // Validaciones básicas
    if (!name || !email || !branch) {
      return NextResponse.json(
        { error: "Faltan name o email" },
        { status: 400 }
      );
    }
    if (!effectiveMonth || !/^\d{4}-\d{2}$/.test(effectiveMonth)) {
      return NextResponse.json(
        { error: "effectiveMonth inválido. Formato: YYYY-MM" },
        { status: 400 }
      );
    }
    if (!Array.isArray(slots) || slots.length === 0) {
      return NextResponse.json(
        { error: "Debes enviar al menos 1 franja horaria" },
        { status: 400 }
      );
    }

    // Normalizar slots -> minutos
    const normSlots = slots.map((s) => ({
      dayOfWeek: Number(s.dayOfWeek),
      startMin: hhmmToMin(s.start),
      endMin: hhmmToMin(s.end),
    }));

    // Verificar email único
    const existing = await User.findOne({ email: email.toLowerCase() }).lean();
    if (existing) {
      return NextResponse.json(
        { error: "Ya existe un usuario con ese email" },
        { status: 409 }
      );
    }

    // Crear professor
    const professor = await User.create({
      name,
      email: email.toLowerCase(),
      role: "professor",
      passwordHash: password, // se hasheará en el modelo
      branch,
      capacity: capacity ? Number(capacity) : undefined,
      activo: true,
    });

    // effectiveFrom = primer día del mes a las 00:00 UTC
    const [y, m] = effectiveMonth.split("-").map(Number);
    const effectiveFrom = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));

    // Crear schedule inicial
    const schedule = await ProfessorSchedule.create({
      professor: professor._id,
      effectiveFrom,
      effectiveTo: null,
      slots: normSlots,
      creadoPor: creadoPor || null,
      branch,
    });

    return NextResponse.json(
      {
        ok: true,
        professorId: professor._id,
        scheduleId: schedule._id,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Error creando professor:", err);
    return NextResponse.json(
      { error: "Error del servidor", details: err?.message },
      { status: 500 }
    );
  }
}

export async function GET(req, { params }) {
  await dbConnect();
  const { branchId } = await params;

  const profs = await User.find({
    branch: branchId,
    role: "professor",
    state: true,
  })
    // .select("_id name email capacity")
    .sort({ name: 1 })
    .lean();
  return Response.json({ professors: profs });
}

export const PUT = async (req) => {
  try {
    await dbConnect();
    const body = await req.json();

    if (!body._id) {
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
    }
    const userToUpdate = await User.findById({ _id: body._id });

    userToUpdate.name = body.name;
    userToUpdate.email = body.email;
    userToUpdate.capacity = body.capacity;

    if (body.passwordHash) {
      userToUpdate.passwordHash = body.passwordHash;
    }
    await userToUpdate.save();

    const { password: userPass, ...rest } = userToUpdate._doc;

    return NextResponse.json(rest, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
};
