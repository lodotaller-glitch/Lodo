import dbConnect from "@/lib/dbConnect";
import Enrollment from "@/models/Enrollment";
import { NextResponse } from "next/server";

export async function PUT() {
  return NextResponse.json({ error: "Use POST" }, { status: 405 });
}

export async function POST(req) {
  try {
    await dbConnect();
    const { enrollmentId } = await req.json();
    if (!enrollmentId)
      return NextResponse.json(
        { error: "Falta enrollmentId" },
        { status: 400 }
      );

    const en = await Enrollment.findById(enrollmentId);
    if (!en || en.state !== "activa")
      return NextResponse.json(
        { error: "Inscripción no encontrada/activa" },
        { status: 404 }
      );

    en.assigned = false; // deja de contar y de mostrarse
    await en.save();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /unassign error:", err);
    return NextResponse.json(
      { error: "Error del servidor", details: err?.message },
      { status: 500 }
    );
  }
}
