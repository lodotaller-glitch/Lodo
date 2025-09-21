// app/api/professors/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";

export async function GET(req) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId");
    const q = { role: "professor", state: true };
    if (branchId) q.branch = branchId;
    const profs = await User.find(q)
      .select("_id name nombre")
      .sort({ name: 1, nombre: 1 })
      .lean();
    return NextResponse.json({
      professors: profs.map((p) => ({
        id: String(p._id),
        name: p.name || p.nombre || "Profesor",
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Error del servidor", details: err?.message },
      { status: 500 }
    );
  }
}
