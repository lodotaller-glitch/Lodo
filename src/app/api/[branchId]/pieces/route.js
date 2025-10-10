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

export async function GET(req, { params }) {
  await dbConnect();
  const me = await getUserFromRequest(req);
  if (!me) return _NR.json({ error: "No autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const { branchId } = await params;
  // Filtros opcionales
  const studentId = searchParams.get("student");
  const title = searchParams.get("title");
  const studentName = searchParams.get("studentName");
  const status = searchParams.get("status");
  const sortField = searchParams.get("sort") || "createdAt";
  const order = searchParams.get("order") === "asc" ? 1 : -1;
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "12", 10);

  let filter = { branch: branchId || me.branch };
  if (me.role === "student") {
    filter.student = me._id;
  } else if (studentId) {
    filter.student = studentId;
  }

  if (title) {
    filter.title = { $regex: title, $options: "i" }; // búsqueda insensible a mayúsculas
  }

  if (studentName) {
    // buscamos IDs de alumnos que coincidan con el nombre
    const users = await User.find({
      name: { $regex: studentName, $options: "i" },
    }).select("_id");
    filter.student = { $in: users.map((u) => u._id) };
  }

  if (status && STATUSES.includes(status)) {
    filter.status = status;
  }

  const total = await Piece.countDocuments(filter);
  const pieces = await Piece.find(filter)
    .sort({ [sortField]: order })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate("student", "name email")
    .lean();

  const totalPages = Math.ceil(total / limit);

  return _NR.json({ ok: true, pieces, totalPages, page });
}

export async function POST(req, { params }) {
  await dbConnect();
  const me = await getUserFromRequest(req);
  if (!me) return _NR.json({ error: "No autenticado" }, { status: 401 });
  if (me.role !== "student" && me.role !== "admin") {
    return _NR.json({ error: "No autorizado" }, { status: 403 });
  }
  const { branchId } = await params;
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

  const piece = await Piece.create({
    title,
    images,
    status,
    student: me._id,
    branch: branchId,
  });
  return _NR.json({ ok: true, piece });
}
