// app/api/[branchId]/enrollments/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import mongoose from "mongoose";
import { Enrollment, ProfessorSchedule, User } from "@/models";
import { slotKey as makeSlotKey } from "@/functions/slotKey";

export const runtime = "nodejs";

const toObjId = (v) => {
  try {
    return new mongoose.Types.ObjectId(String(v));
  } catch {
    return null;
  }
};
const startOfMonthUTC = (y, m) => new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));

export async function POST(req, { params }) {
  await dbConnect();
  const { branchId } = (await params) || {};
  const body = await req.json();

  const studentId = toObjId(body.studentId);
  const professorId = toObjId(body.professorId);
  const year = Number(body.year);
  const month = Number(body.month);
  const assignNow = true;
  let chosenSlots = Array.isArray(body.chosenSlots) ? body.chosenSlots : [];

  if (!studentId || !professorId || !year || !month) {
    return NextResponse.json(
      { error: "Faltan studentId/professorId/year/month" },
      { status: 400 }
    );
  }

  // Traer schedule vigente para ese mes
  const sched = await ProfessorSchedule.findActiveForDate(
    professorId,
    startOfMonthUTC(year, month)
  );
  if (!sched) {
    return NextResponse.json(
      { error: "Profesor sin horario vigente para ese mes" },
      { status: 400 }
    );
  }

  // Si viene slotKey, derivar a chosenSlots[0]
  if (!chosenSlots.length && body.slotKey) {
    // Podemos validar contra los slots del schedule
    const s = sched.slots.find(
      (sl) => makeSlotKey(sl, String(professorId)) === body.slotKey
    );
    if (!s) {
      return NextResponse.json(
        { error: "slotKey no coincide con el horario del profesor" },
        { status: 409 }
      );
    }
    chosenSlots = [
      { dayOfWeek: s.dayOfWeek, startMin: s.startMin, endMin: s.endMin },
    ];
  }

  if (!chosenSlots.length) {
    return NextResponse.json(
      { error: "Debes enviar chosenSlots o slotKey" },
      { status: 400 }
    );
  }
  if (chosenSlots.length > 2) {
    return NextResponse.json(
      { error: "Máximo 2 franjas por inscripción" },
      { status: 400 }
    );
  }

  // Validar que existan en el schedule
  const validSet = new Set(
    sched.slots.map((sl) => makeSlotKey(sl, String(professorId)))
  );
  for (const s of chosenSlots) {
    const k = makeSlotKey(s, String(professorId));
    if (!validSet.has(k)) {
      return NextResponse.json(
        { error: "Alguna franja no existe en el horario del profesor" },
        { status: 409 }
      );
    }
  }

  // Capacidad si se crea asignada
  if (assignNow) {
    const prof = await User.findById(professorId).lean();
    const capacity = Math.max(1, Number(prof?.capacity ?? 10));
    for (const s of chosenSlots) {
      const same = await Enrollment.countDocuments({
        professor: professorId,
        year,
        month,
        $or: [{ state: "activa" }, { estado: "activa" }],
        assigned: true,
        chosenSlots: { $elemMatch: s },
      });
      if (same >= capacity) {
        return NextResponse.json(
          { error: "Sin cupo en alguna franja", slot: s },
          { status: 409 }
        );
      }
    }
  }

  try {
    const doc = await Enrollment.create({
      student: studentId,
      professor: professorId,
      branch: toObjId(branchId),
      year,
      month,
      chosenSlots,
      maxWeeklySlots: Math.min(2, chosenSlots.length || 1),
      state: "activa",
      assigned: Boolean(assignNow),
      pay: { state: "pendiente", method: "no_aplica" },
    });
    await User.updateOne({ _id: studentId }, { $inc: { clayKg: 1.5 } });
    return NextResponse.json({ ok: true, enrollmentId: String(doc._id) });
  } catch (err) {
    if (String(err?.message || "").includes("duplicate key")) {
      return NextResponse.json(
        { error: "Ya existe una inscripción activa para ese profe y mes" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "No se pudo crear", details: err?.message },
      { status: 500 }
    );
  }
}
