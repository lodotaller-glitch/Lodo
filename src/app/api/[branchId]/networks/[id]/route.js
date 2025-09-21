import { NextResponse } from "next/server";
import User from "@/models/User";
import dbConnect from "@/lib/dbConnect";

export async function GET(_req, { params }) {
  try {
    await dbConnect();
    const { id } = await params;

    const user = await User.findById(id)
      .select("name email role state capacity")
      .lean();
    if (!user)
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    return NextResponse.json({ user });
  } catch (err) {
    console.error("GET /api/users/[id]", err);
    return NextResponse.json(
      { error: "Error del servidor", details: err?.message },
      { status: 500 }
    );
  }
}

export async function PUT(req, { params }) {
  try {
    await dbConnect();
    const { id } = await params;
    const body = await req.json();
    const { name, email, role, state, password } = body || {};

    const user = await User.findById(id);
    if (!user)
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );

    if (email && email !== user.email) {
      const exists = await User.findOne({
        email: email.toLowerCase(),
        _id: { $ne: id },
      }).lean();
      if (exists)
        return NextResponse.json(
          { error: "Ese email ya está en uso" },
          { status: 409 }
        );
      user.email = email.toLowerCase();
    }

    if (name !== undefined) user.name = name;
    if (role !== undefined) user.role = role; // si querés, podés restringir cambios de rol
    if (state !== undefined) user.state = Boolean(state);
    if (password) user.passwordHash = password;

    await user.save();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PUT /api/users/[id]", err);
    return NextResponse.json(
      { error: "Error del servidor", details: err?.message },
      { status: 500 }
    );
  }
}
