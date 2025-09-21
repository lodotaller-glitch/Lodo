// /app/api/[branchId]/classes/status/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import { Attendance } from "@/models";

export async function GET(req, { params }) {
  try {
    await dbConnect();
    const { branchId } = await params;
    const { searchParams } = new URL(req.url);

    const studentId = searchParams.get("studentId");
    const professorId =
      searchParams.get("professorId") || searchParams.get("profesorId");
    const start = searchParams.get("start");

    if (!studentId || !professorId || !start) {
      return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
    }

    const startDate = new Date(start);
    if (isNaN(startDate.getTime())) {
      return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
    }

    // Buscamos una asistencia (regular o adhoc) EXACTA para ese alumno, profe y fecha.
    // Tus upserts de asistencia "regular" guardan también student.
    const att = await Attendance.findOne({
      student: studentId,
      professor: professorId,
      branch: branchId,
      date: startDate,
      removed: { $ne: true },
    })
      .select("status origin")
      .lean();

    const attended = att?.status === "presente";

    const now = new Date();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const tooOld = now.getTime() > startDate.getTime() + sevenDaysMs;

    const reschedulable = !attended && !tooOld;

    return NextResponse.json({
      attended,
      reschedulable,
      tooOld,
      origin: att?.origin || null,
      now: now.toISOString(),
    });
  } catch (err) {
    console.error("GET /classes/status error:", err);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}
