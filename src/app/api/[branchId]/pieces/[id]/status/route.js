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

export async function PATCH(req, { params }) {
  await dbConnect();
  const me = await getUserFromRequest(req);
  if (!me) return _NR.json({ error: "No autenticado" }, { status: 401 });
  if (me.role !== "professor" && me.role !== "admin")
    return _NR.json({ error: "No autorizado" }, { status: 403 });

  const body = await req.json();

  const { id } = await params;

  const { status } = body || {};
  if (!STATUSES.includes(status))
    return _NR.json({ error: "Estado inválido" }, { status: 400 });

  const piece = await Piece.findById(id);
  if (!piece) return _NR.json({ error: "No encontrada" }, { status: 404 });

  const prev = piece.status;
  piece.status = status;
  await piece.save();

  ("hola");
  // Si pasó a Lista y antes no lo estaba -> enviar email
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

  return _NR.json({ ok: true, piece });
}
