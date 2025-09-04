import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Enrollment from "@/models/Enrollment";
import { User } from "@/models";

export async function GET(_req, { params }) {
  try {
    await dbConnect();
    const { studentId } = await params;
    
    if (!studentId)
      return NextResponse.json({ error: "Falta studentId" }, { status: 400 });

    const enrollments = await Enrollment.find({ student: studentId })
      .populate("professor", "name")
      .sort({ year: -1, month: -1 })
      .lean();

    return NextResponse.json({ enrollments });
  } catch (err) {
    console.error("GET /by-student error:", err);
    return NextResponse.json(
      { error: "Error del servidor", details: err?.message },
      { status: 500 }
    );
  }
}
