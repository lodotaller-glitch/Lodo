export const runtime = "nodejs";

import { NextResponse as _NR } from "next/server";
import dbConnect from "@/lib/dbConnect";
import { Piece, User } from "@/models";
import { getUserFromRequest } from "@/lib/authserver";
import { sendPieceReadyEmail } from "@/lib/mailer";

const STATUSES = [
  "Lista",
  "En preparacion",
  "En el horno",
  "Destruida",
  "Sin terminar",
];

function canRead(me, piece) {
  if (!me) return false;
  if (me.role === "admin" || me.role === "professor") return true;
  return String(piece.student) === String(me._id);
}
export async function GET(req, { params }) {
  await dbConnect();
  const me = await getUserFromRequest(req);
  const { id } = await params;
  const piece = await Piece.findById(id);
  if (!piece) return _NR.json({ error: "No encontrada" }, { status: 404 });
  if (!canRead(me, piece))
    return _NR.json({ error: "No autorizado" }, { status: 403 });
  return _NR.json({ ok: true, piece });
}
export async function PUT(req, { params }) {
  await dbConnect();
  const me = await getUserFromRequest(req);
  const { id } = await params;
  const piece = await Piece.findById(id);
  if (!piece) return _NR.json({ error: "No encontrada" }, { status: 404 });

  // Alumno: puede editar título/imagenes pero NO el estado
  if (me.role === "student" && String(piece.student) !== String(me._id)) {
    return _NR.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await req.json();
  const patch = {};
  if (typeof body.title === "string") patch.title = body.title;
  if (Array.isArray(body.images)) {
    if (
      body.images.length > 5 ||
      body.images.some((u) => {
        try {
          new URL(u);
          return false;
        } catch {
          return true;
        }
      })
    )
      return _NR.json({ error: "Imágenes inválidas" }, { status: 400 });
    patch.images = body.images;
  }

  if (typeof body.status === "string") {
    if (!STATUSES.includes(body.status)) {
      return _NR.json({ error: "Estado inválido" }, { status: 400 });
    }

    patch.status = body.status;
  }

  // Estado se gestiona en /status (para disparar email)
  const updated = await Piece.findByIdAndUpdate(
    id,
    { $set: patch },
    { new: true }
  );
  const prev = piece.status;
  const status = updated.status;

  if (status === "Lista" && prev !== "Lista") {
    const student = await User.findById(piece.student).lean();
    if (student?.email) {
      try {
        await sendPieceReadyEmail(student.email, {
          studentName: student.name || student.fullName || "",
          pieceTitle: piece.title,
        });
      } catch (err) {
        console.error("Error enviando email:", err);
        // No hacemos rollback del estado, pero avisamos
        return _NR.json({ ok: true, piece, emailError: true });
      }
    }
  }
  return _NR.json({ ok: true, piece: updated });
}

export async function DELETE(req, { params }) {
  await dbConnect();
  const { id } = await params;
  const me = await getUserFromRequest(req);
  const piece = await Piece.findById(id);
  if (!piece) return _NR.json({ error: "No encontrada" }, { status: 404 });
  if (
    me.role !== "admin" &&
    !(me.role === "student" && String(piece.student) === String(me._id))
  ) {
    return _NR.json({ error: "No autorizado" }, { status: 403 });
  }
  await piece.deleteOne();
  return _NR.json({ ok: true });
}
