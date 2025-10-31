import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import AdhocClass from "@/models/AdhocClass";

function dateOnlyUTC(d) {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
}

export async function GET(req, { params }) {
  try {
    await dbConnect();
    const { branchId, id: professorId } = await params;
    const url = new URL(req.url);
    const year = Number(url.searchParams.get("year"));
    const month = Number(url.searchParams.get("month"));

    if (!professorId)
      return NextResponse.json(
        { error: "professorId required" },
        { status: 400 }
      );

    const q = { professor: professorId, removed: { $ne: true } };

    // Filtro mes/año correctamente
    if (Number.isInteger(year) && Number.isInteger(month)) {
      const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
      const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
      q.date = { $gte: start, $lte: end };
    }

    if (branchId) q.branch = branchId;

    const classes = await AdhocClass.find(q).lean();
    return NextResponse.json({ classes });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    await dbConnect();
    const { branchId, id: professorId } = await params;
    const body = await req.json();
    const { date, slotSnapshot, capacity = 10, notes } = body;

    if (!professorId || !date || !slotSnapshot || !branchId)
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    const d = new Date(date);
    if (isNaN(d.getTime()))
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });

    const dateOnly = dateOnlyUTC(d);

    const newC = await AdhocClass.create({
      professor: professorId,
      branch: branchId,
      date: dateOnly,
      slotSnapshot,
      capacity,
      notes,
      createdBy: req.headers.get("x-user-id") || undefined,
    });

    return NextResponse.json({ class: newC }, { status: 201 });
  } catch (err) {
    console.error("create adhoc error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
