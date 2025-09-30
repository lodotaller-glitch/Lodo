// /app/api/[branchId]/enrollments/pay/route.js
import { getUserFromRequest } from "@/lib/authserver";
import dbConnect from "@/lib/dbConnect";
import Enrollment from "@/models/Enrollment";
import { NextResponse } from "next/server";

const STATES = new Set(["pendiente", "señado", "pagado", "cancelado"]);
const METHODS = new Set(["transferencia", "efectivo", "otro", "no_aplica"]);

export async function POST(req) {
  try {
    await dbConnect();

    const user = await getUserFromRequest(req);
    const isAdmin = user?.role;

    const body = await req.json();
    const {
      enrollmentId,
      which = "pay", // "pay" | "pay2"
      state,
      method,
      amount,
      currency, // preferido
      corrency, // compat viejo typo
      reference,
      observations,
      finalize = true, // si true: se "sella" (locked) al guardar (no-admin)
      unlock = false, // solo admin: desbloquear
    } = body || {};

    if (!enrollmentId) {
      return NextResponse.json(
        { error: "Falta enrollmentId" },
        { status: 400 }
      );
    }
    if (!["pay", "pay2"].includes(which)) {
      return NextResponse.json({ error: "which inválido" }, { status: 400 });
    }
    if (state !== undefined && !STATES.has(state)) {
      return NextResponse.json(
        { error: "Estado de pago inválido" },
        { status: 400 }
      );
    }
    if (method !== undefined && !METHODS.has(method)) {
      return NextResponse.json(
        { error: "Método de pago inválido" },
        { status: 400 }
      );
    }
    if (amount !== undefined && Number(amount) < 0) {
      return NextResponse.json({ error: "Monto inválido" }, { status: 400 });
    }

    const en = await Enrollment.findById(enrollmentId);
    if (!en) {
      return NextResponse.json(
        { error: "Inscripción no encontrada" },
        { status: 404 }
      );
    }

    // Asegurar que existan los subdocs necesarios
    if (!en.pay) en.pay = {};
    if (which === "pay2" && !en.pay2) {
      en.pay2 = {}; // crear pay2 on-demand
    }

    const p = which === "pay2" ? en.pay2 : en.pay;

    // Intento de desbloqueo
    if (unlock) {
      if (!isAdmin) {
        return NextResponse.json(
          { error: "Solo admin puede desbloquear" },
          { status: 403 }
        );
      }
      p.locked = false;
      p.lockedAt = null;
      p.lockedBy = null;
    }

    // Si está bloqueado y no es admin, no permitir edición
    if (p.locked && !isAdmin) {
      return NextResponse.json(
        { error: "El pago está bloqueado" },
        { status: 403 }
      );
    }

    // Patch de campos
    if (state !== undefined) p.state = state;
    if (method !== undefined) p.method = method;
    if (amount !== undefined) p.amount = Number(amount);
    // currency: acepta currency y corrency (compat)
    const finalCurrency = currency ?? corrency;
    if (finalCurrency !== undefined) p.currency = String(finalCurrency);

    if (reference !== undefined) p.reference = reference;
    if (observations !== undefined) p.observations = observations;

    // Sellado automático: si no es admin y finalize=true, se bloquea
    if (finalize && !isAdmin) {
      p.locked = true;
      p.lockedAt = new Date();
      // Opcional: setear lockedBy si tenés userId en el servidor
      // p.lockedBy = session?.user?._id ?? null;
    }
    p.locked = true;
    await en.save();

    return NextResponse.json({
      ok: true,
      enrollment: {
        _id: en._id,
        pay: en.pay,
        pay2: en.pay2 ?? null,
      },
    });
  } catch (err) {
    console.error("/enrollments/pay error:", err);
    return NextResponse.json(
      { error: "Error del servidor", details: err?.message },
      { status: 500 }
    );
  }
}
