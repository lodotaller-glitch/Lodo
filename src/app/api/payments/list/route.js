// app/api/payments/list/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Enrollment from "@/models/Enrollment";
import User from "@/models/User";
import mongoose from "mongoose";

function toObjId(id) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

export async function GET(req) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);

    const year = Number(searchParams.get("year"));
    const month = Number(searchParams.get("month"));
    const branchId = searchParams.get("branchId");
    const professorId = searchParams.get("professorId");
    const method = searchParams.get("method"); // transferencia/efectivo/otro/no_aplica
    const payState = searchParams.get("payState"); // pendiente/señado/pagado/cancelado
    const state = searchParams.get("state") || "activa"; // estado de inscripción
    const assignedParam = searchParams.get("assigned") || true; // estado de inscripción

    let assigned;
    if (assignedParam === "true") assigned = true;
    else if (assignedParam === "false") assigned = false;

    if (
      !Number.isInteger(year) ||
      !Number.isInteger(month) ||
      month < 1 ||
      month > 12
    ) {
      return NextResponse.json(
        { error: "Parámetros year/month inválidos" },
        { status: 400 }
      );
    }

    const q = { year, month, state };

    if (assigned !== undefined) {
      q.assigned = assigned;
    }
    if (branchId) {
      const bid = toObjId(branchId);
      if (bid) q.branch = bid;
    }
    if (professorId) {
      const pid = toObjId(professorId);
      if (pid) q.professor = pid;
    }
    if (method) {
      q.$or = [{ "pay.method": method }, { "pay2.method": method }];
    }
    if (payState) {
      // Si ya existe un $or (por method), lo agregamos; si no, lo creamos
      q.$or = [
        ...(q.$or || []),
        { "pay.state": payState },
        { "pay2.state": payState },
      ];
    }

    const items = await Enrollment.find(q)
      .select("student professor year month pay pay2 state")
      .populate("student", "name nombre email")
      .populate("professor", "name nombre")
      .sort({ "pay.state": 1, "pay.method": 1 })
      .lean();

    // Normalizamos salida
    const rows = items.map((e) => ({
      id: String(e._id),
      studentName: e.student?.name || e.student?.nombre || "Alumno",
      studentEmail: e.student?.email || undefined,
      professorId: e.professor?._id ? String(e.professor._id) : undefined,
      professorName: e.professor?.name || e.professor?.nombre || "Profesor",
      pay: {
        state: e.pay2?.state || e.pay?.state || "pendiente",
        method: e.pay2?.method
          ? e.pay?.method + " - " + e.pay2?.method
          : e.pay?.method || "no_aplica",
        amount: Number(e.pay2?.amount || 0) + Number(e.pay?.amount || 0),
        currency: e.pay?.currency || "ARS",
        reference: e.pay?.reference || "",
      },
      year: e.year,
      month: e.month,
    }));

    // total simple de la lista (p/tabla)
    const totalAmount = rows.reduce(
      (a, r) =>
        a +
        (r.pay.state === "pagado" || r.pay.state === "señado"
          ? r.pay.amount
          : 0),
      0
    );

    return NextResponse.json({ items: rows, totalAmount });
  } catch (err) {
    console.error("GET /api/payments/list error:", err);
    return NextResponse.json(
      { error: "Error del servidor", details: err?.message },
      { status: 500 }
    );
  }
}
