import { NextResponse } from "next/server";
import User from "@/models/User";
import dbConnect from "@/lib/dbConnect";

export async function GET(req) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(
      100,
      Math.max(1, Number(searchParams.get("limit") || 10))
    );
    const stateParam = searchParams.get("state"); // 'active' | 'inactive' | null
    const branch = searchParams.get("branch");

    const filter = { role: "networks", branch };
    if (stateParam === "active") filter.state = true;
    if (stateParam === "inactive") filter.state = false;
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
      ];
    }

    const total = await User.countDocuments(filter);
    const items = await User.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select("name email state createdAt")
      .lean();

    return NextResponse.json({
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("GET /api/students error:", err);
    return NextResponse.json(
      { error: "Error del servidor", details: err?.message },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    await dbConnect();
    const body = await req.json();
    const {
      name,
      email,
      password,
      branch,
      creadoPor, // opcional: _id del admin o 'redes' que hace la acción
    } = body || {};

    // Validaciones básicas
    if (!name || !email || !branch) {
      return NextResponse.json(
        { error: "Faltan name o email" },
        { status: 400 }
      );
    }

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
      role: "networks",
      passwordHash: password, // se hasheará en el modelo
      branch,
      activo: true,
    });

    return NextResponse.json(
      {
        ok: true,
        professorId: professor._id,
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
