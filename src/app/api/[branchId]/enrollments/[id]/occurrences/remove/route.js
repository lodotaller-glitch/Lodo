import { NextResponse as NR } from "next/server";
import dbConnect from "@/lib/dbConnect";
import { Enrollment, StudentReschedule, Attendance } from "@/models";
import mongoose from "mongoose";

const toId = (v) => {
  try {
    return new mongoose.Types.ObjectId(String(v));
  } catch {
    return null;
  }
};

export async function POST(req, { params }) {
  await dbConnect();
  const { id } = (await params) || {};
  const enrollmentId = toId(id);

  if (!enrollmentId) {
    return NR.json({ error: "ID de inscripción inválido" }, { status: 400 });
  }

  // payload: { origin: 'adhoc'|'reschedule-in', attendanceId?, rescheduleId? }
  const body = await req.json().catch(() => ({}));
  const origin = String(body.origin || "").toLowerCase();
  const attendanceId = body.attendanceId ? toId(body.attendanceId) : null;
  const rescheduleId = body.rescheduleId ? toId(body.rescheduleId) : null;

  const en = await Enrollment.findById(enrollmentId).lean();
  if (!en)
    return NR.json({ error: "Inscripción no encontrada" }, { status: 404 });

  try {
    if (origin === "adhoc") {
      if (!attendanceId)
        return NR.json({ error: "Falta attendanceId" }, { status: 400 });

      // Soft delete: marcamos removed=true (tu GET ya filtra removed !== true)
      const res = await Attendance.updateOne(
        {
          _id: attendanceId,
          student: en.student, // seguridad básica
          // branch: en.branch,            // si querés más restricción
          removed: { $ne: true },
        },
        { $set: { removed: true } }
      );

      return NR.json({ ok: true, updated: res.modifiedCount || 0, origin });
    }

    if (origin === "reschedule-in") {
      if (!rescheduleId)
        return NR.json({ error: "Falta rescheduleId" }, { status: 400 });

      // Eliminar la reprogramación (esto también quita el OUT y vuelve a aparecer la base)
      const res = await StudentReschedule.deleteOne({
        _id: rescheduleId,
        $or: [
          { enrollment: en._id }, // camino más directo si se guardó
          { student: en.student }, // fallback
        ],
      });

      return NR.json({ ok: true, deleted: res.deletedCount || 0, origin });
    }

    return NR.json({ error: "Origen no soportado" }, { status: 400 });
  } catch (err) {
    console.error("POST /enrollments/[id]/occurrences/remove error:", err);
    return NR.json(
      { error: "No se pudo eliminar la ocurrencia", details: err?.message },
      { status: 500 }
    );
  }
}
