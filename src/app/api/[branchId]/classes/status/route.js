// /app/api/[branchId]/classes/status/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import { Attendance, StudentReschedule } from "@/models";
import moment from "moment";

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

    const monthStart = moment(startDate).utc().startOf("month").toDate();
    const monthEnd = moment(startDate).utc().endOf("month").toDate();

    // Buscamos una asistencia (regular o adhoc) EXACTA para ese alumno, profe y fecha.
    // Tus upserts de asistencia "regular" guardan también student.

    const existsReschedule = !!(await StudentReschedule.exists({
      student: studentId,
      professor: professorId,
      branch: branchId,
      toDate: startDate,
    }));

    const existsRescheduleInMonth = !!(await StudentReschedule.exists({
      student: studentId,
      professor: professorId,
      branch: branchId,
      fromDate: {
        $gte: monthStart,
        $lte: monthEnd,
      },
    }));

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
      existsReschedule: existsReschedule || existsRescheduleInMonth,
    });
  } catch (err) {
    console.error("GET /classes/status error:", err);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}
