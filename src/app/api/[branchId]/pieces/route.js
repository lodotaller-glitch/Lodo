import { NextResponse as _NR } from "next/server";
import dbConnect from "@/lib/dbConnect";
import { Piece, User } from "@/models";
import { getUserFromRequest } from "@/lib/authserver";

const STATUSES = [
  "Lista",
  "En preparacion",
  "En el horno",
  "Destruida",
  "Sin terminar",
];

function isValidUrl(u) {
  try {
    new URL(u);
    return true;
  } catch {
    return false;
  }
}

export async function GET(req) {
  await dbConnect();
  const me = await getUserFromRequest(req);
  if (!me) return _NR.json({ error: "No autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("student");

  let filter = {};
  if (me.role === "student") {
    filter.student = me._id;
  } else if (studentId) {
    filter.student = studentId;
  }

  const pieces = await Piece.find(filter).sort({ createdAt: -1 }).lean();
  return _NR.json({ ok: true, pieces });
}

export async function POST(req) {
  await dbConnect();
  const me = await getUserFromRequest(req);
  if (!me) return _NR.json({ error: "No autenticado" }, { status: 401 });
  if (me.role !== "student" && me.role !== "admin") {
    return _NR.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await req.json();
  const { title, images = [], status = "Sin terminar" } = body || {};

  if (!title || typeof title !== "string")
    return _NR.json({ error: "Título requerido" }, { status: 400 });

  if (!STATUSES.includes(status))
    return _NR.json({ error: "Estado inválido" }, { status: 400 });

  if (
    !Array.isArray(images) ||
    images.length > 5 ||
    !images.every(isValidUrl)
  ) {
    return _NR.json(
      { error: "Imágenes inválidas (máx 5 y deben ser URLs)" },
      { status: 400 }
    );
  }

  const piece = await Piece.create({ title, images, status, student: me._id });
  return _NR.json({ ok: true, piece });
}
