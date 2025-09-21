// app/api/[branchId]/enrollments/[id]/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import mongoose from "mongoose";
import { Enrollment, StudentReschedule } from "@/models";

export const runtime = "nodejs";

const toObjId = (v) => {
  try {
    return new mongoose.Types.ObjectId(String(v));
  } catch {
    return null;
  }
};

export async function DELETE(_req, { params }) {
  await dbConnect();

  const { branchId, id } = await params || {};
  const enrollmentId = toObjId(id);

  if (!enrollmentId) {
    return NextResponse.json(
      { error: "ID de inscripción inválido" },
      { status: 400 }
    );
  }

  // Validar que la inscripción pertenezca a la branch
  const en = await Enrollment.findOne({ _id: enrollmentId }).lean();
  if (!en)
    return NextResponse.json(
      { error: "Inscripción no encontrada" },
      { status: 404 }
    );
  if (String(en.branch) !== String(branchId)) {
    return NextResponse.json(
      { error: "La inscripción no pertenece a esta sucursal" },
      { status: 403 }
    );
  }

  const session = await mongoose.startSession();
  try {
    let result = {};
    await session.withTransaction(async () => {
      const resReschedules = await StudentReschedule.deleteMany(
        { enrollment: enrollmentId },
        { session }
      );
      const resEnrollment = await Enrollment.deleteOne(
        { _id: enrollmentId },
        { session }
      );
      result = {
        reschedulesDeleted: resReschedules.deletedCount || 0,
        enrollmentDeleted: resEnrollment.deletedCount || 0,
      };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: "No se pudo eliminar la inscripción", details: err?.message },
      { status: 500 }
    );
  } finally {
    session.endSession();
  }
}
