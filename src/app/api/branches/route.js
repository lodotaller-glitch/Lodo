import { NextResponse as NR } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Branch from "@/models/Branch";
import { accesAdmin, getUserFromRequest } from "@/lib/authserver";

export async function GET() {
  await dbConnect();
  const branches = await Branch.find({}).sort({ createdAt: -1 }).lean();
  return NR.json({ branches });
}

export async function POST(req) {
  await dbConnect();
  if (!accesAdmin(req, true))
    return NR.json({ error: "Unauthorized" }, { status: 403 });
  const { name, code, address = "", phone = "" } = await req.json();
  if (!name || !code)
    return NR.json({ error: "Missing name/code" }, { status: 400 });
  const exists = await Branch.findOne({ code }).lean();
  if (exists) return NR.json({ error: "Code already exists" }, { status: 409 });
  const doc = await Branch.create({ name, code, address, phone });
  return NR.json({ ok: true, branchId: doc._id }, { status: 201 });
}
