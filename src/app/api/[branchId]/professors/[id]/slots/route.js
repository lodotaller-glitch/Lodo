import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import { ProfessorSchedule } from "@/models";

export async function GET(_req, { params }) {
  try {
    await dbConnect();
    const { id } = await params;
    const url = new URL(_req.url);
    const year = Number(url.searchParams.get("year"));
    const month = Number(url.searchParams.get("month"));

    if (!id || !year || !month)
      return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
    const start = new Date(Date.UTC(year, month - 1, 1));
    const sched = await ProfessorSchedule.findActiveForDate(id, start);
    if (!sched) return NextResponse.json({ slots: [] });
    return NextResponse.json({ slots: sched.slots });
  } catch (err) {
    console.error("GET /professors/[id]/slots", err);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}
