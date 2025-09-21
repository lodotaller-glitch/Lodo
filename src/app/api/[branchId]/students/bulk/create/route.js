// app/api/[branchId]/students/bulk/create/route.js
import { NextResponse } from "next/server";
export const runtime = "nodejs";

import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";
import Enrollment from "@/models/Enrollment";

import mongoose from "mongoose";
import { sendNewAccountEmail } from "@/lib/mailer";

function toObjId(x) {
  try {
    return new mongoose.Types.ObjectId(String(x));
  } catch {
    return null;
  }
}

export async function POST(req, { params }) {
  try {
    await dbConnect();
    const { branchId } = await params;
    const body = await req.json();

    const { year, month, students } = body || {};
    if (
      !Number.isInteger(year) ||
      !Number.isInteger(month) ||
      !Array.isArray(students)
    ) {
      return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
    }

    const results = [];

    for (const row of students) {
      const {
        name,
        email,
        password,
        assignment, // { professorId, slot: {dayOfWeek,startMin,endMin}, professorName, weekdayLabel, timeRangeLabel }
      } = row;

      if (!name || !email) {
        results.push({ email, ok: false, error: "Faltan name/email" });
        continue;
      }
      if (!assignment || !assignment.professorId || !assignment.slot) {
        results.push({
          email,
          ok: false,
          error: "Falta asignación (profesor/slot)",
        });
        continue;
      }

      try {
        // 1) upsert de usuario (role student)
        let user = await User.findOne({ email }).lean();
        if (!user) {
          const doc = new User({
            name,
            email,
            passwordHash: 12345, // si tenés hook de hash, se aplica
            role: "student",
            branch: branchId,
            state: true,
          });
          user = (await doc.save()).toObject();
        }

        // 2) crear inscripción (si no existe)
        const exists = await Enrollment.findOne({
          student: user._id,
          professor: assignment.professorId,
          branch: branchId,
          year,
          month,
          state: "activa",
        }).lean();

        if (exists) {
          results.push({
            email,
            ok: false,
            error: "Ya existe inscripción activa para ese mes/profesor",
          });
          continue;
        }

        const en = new Enrollment({
          student: user._id,
          professor: assignment.professorId,
          branch: branchId,
          year,
          month,
          chosenSlots: [assignment.slot],
          maxWeeklySlots: 1,
          state: "activa",
          assigned: true,
          pay: { state: "pendiente", method: "no_aplica" },
        });
        const saved = await en.save();
        await User.updateOne({ _id: user._id }, { $inc: { clayKg: 1.5 } });

        // 3) email
        try {
          await sendNewAccountEmail(email, {
            studentName: name,
            email,
            tempPassword: password || undefined,
            professorName: assignment.professorName,
            weekdayLabel: assignment.weekdayLabel,
            timeRangeLabel: assignment.timeRangeLabel,
            year,
            month,
          });
        } catch (e) {
          // no cortar el flujo por fallo de email
          console.error("email error", email, e?.message);
        }

        results.push({ email, ok: true, enrollmentId: String(saved._id) });
      } catch (e) {
        results.push({ email, ok: false, error: e?.message || "Error" });
      }
    }

    return NextResponse.json({ ok: true, results });
  } catch (err) {
    console.error("bulk/create error:", err);
    return NextResponse.json(
      { error: "Error del servidor", details: err?.message },
      { status: 500 }
    );
  }
}
