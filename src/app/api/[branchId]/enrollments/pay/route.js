import dbConnect from "@/lib/dbConnect";
import Enrollment from "@/models/Enrollment";
import { NextResponse } from "next/server";

const STATES = new Set(["pendiente", "señado", "pagado", "cancelado"]);
const METHODS = new Set(["transferencia", "efectivo", "otro", "no_aplica"]);

export async function POST(req) {
  try {
    await dbConnect();
    const {
      enrollmentId,
      state,
      method,
      amount,
      corrency,
      reference,
      observations,
    } = await req.json();

    if (!enrollmentId)
      return NextResponse.json(
        { error: "Falta enrollmentId" },
        { status: 400 }
      );
    const en = await Enrollment.findById(enrollmentId);
    if (!en)
      return NextResponse.json(
        { error: "Inscripción no encontrada" },
        { status: 404 }
      );

    if (state && !STATES.has(state))
      return NextResponse.json(
        { error: "Estado de pago inválido" },
        { status: 400 }
      );
    if (method && !METHODS.has(method))
      return NextResponse.json(
        { error: "Método de pago inválido" },
        { status: 400 }
      );
    if (amount !== undefined && Number(amount) < 0)
      return NextResponse.json({ error: "Monto inválido" }, { status: 400 });

    if (!en.pay) en.pay = {};
    if (state !== undefined) en.pay.state = state;
    if (method !== undefined) en.pay.method = method;
    if (amount !== undefined) en.pay.amount = Number(amount);
    if (corrency !== undefined) en.pay.corrency = corrency; // respeta tu typo de schema
    if (reference !== undefined) en.pay.reference = reference;
    if (observations !== undefined) en.pay.observations = observations;

    await en.save();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("/pay error:", err);
    return NextResponse.json(
      { error: "Error del servidor", details: err?.message },
      { status: 500 }
    );
  }
}
