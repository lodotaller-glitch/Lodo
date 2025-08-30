import { NextResponse as NR4 } from "next/server";
import dbConnect from "@/lib/dbConnect";
import { ProfessorSchedule } from "@/models";

export async function GET(req, { params }) {
  await dbConnect();
  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));
  const { id } = await params;
  if (!year || !month)
    return NR4.json({ error: "Missing year/month" }, { status: 400 });
  const sched = await ProfessorSchedule.findActiveForDate(
    id,
    new Date(Date.UTC(year, month - 1, 1))
  );
  return NR4.json({
    schedule: sched ? { id: sched._id, slots: sched.slots } : null,
  });
}

export async function PUT(req, { params }) {
  const { branchId, id } = params;
  await dbConnect();
  const body = await req.json();
  const updatedSchedule = await ProfessorSchedule.findOneAndUpdate(
    { professor: id, branch: branchId },
    { slots: body.slots },
    { new: true }
  );
  if (!updatedSchedule)
    return new Response("Error al actualizar el horario", { status: 400 });
  return new Response(JSON.stringify(updatedSchedule), { status: 200 });
}
