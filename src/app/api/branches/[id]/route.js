// app/api/branches/[id]/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import mongoose from "mongoose";
import {
  Branch,
  User,
  Enrollment,
  ProfessorSchedule,
  StudentReschedule,
  Attendance,
  Piece,
} from "@/models";

export const runtime = "nodejs"; // necesitamos Node (no Edge) para transacciones

function toObjId(v) {
  try {
    return new mongoose.Types.ObjectId(String(v));
  } catch {
    return null;
  }
}

export async function DELETE(_req, { params }) {
  await dbConnect();

  const { id } = await params || {};
  const branchObjId = toObjId(id);
  const branchIdStr = String(id);

  if (!branchObjId) {
    return NextResponse.json({ error: "BranchId inválido" }, { status: 400 });
  }

  const branch = await Branch.findById(branchObjId).lean();
  if (!branch) {
    return NextResponse.json(
      { error: "Sucursal no encontrada" },
      { status: 404 }
    );
  }

  const session = await mongoose.startSession();
  try {
    let result = {};
    await session.withTransaction(async () => {
      // 1) Usuarios de la branch (excepto admin)
      const usersToDelete = await User.find({
        $or: [{ branch: branchObjId }, { branch: branchIdStr }],
        role: { $ne: "admin" },
      })
        .select("_id role")
        .session(session)
        .lean();

      const userIds = usersToDelete.map((u) => u._id);
      const professorIds = usersToDelete
        .filter((u) => u.role === "professor")
        .map((u) => u._id);
      const studentIds = usersToDelete
        .filter((u) => u.role === "student")
        .map((u) => u._id);

      // 2) Borrar datos relacionados a la branch
      // Enrollments (por branch es suficiente, cubre student/professor de la sucursal)
      const enrollDel = await Enrollment.deleteMany(
        {
          $or: [{ branch: branchObjId }, { branch: branchIdStr }],
        },
        { session }
      );

      // Schedules de profesores de la branch
      const schedDel = await ProfessorSchedule.deleteMany(
        {
          $or: [{ branch: branchObjId }, { branch: branchIdStr }],
        },
        { session }
      );

      // Asistencias de la branch (y por si acaso por student/professor borrados)
      const attDel = await Attendance.deleteMany(
        {
          $or: [
            { branch: branchObjId },
            { branch: branchIdStr },
            studentIds.length ? { student: { $in: studentIds } } : null,
            professorIds.length ? { professor: { $in: professorIds } } : null,
          ].filter(Boolean),
        },
        { session }
      );

      // Reprogramaciones relacionadas (no siempre tienen branch, así que enlazamos por ids)
      const resDel = await StudentReschedule.deleteMany(
        {
          $or: [
            studentIds.length ? { student: { $in: studentIds } } : null,
            professorIds.length ? { professor: { $in: professorIds } } : null, // compat legado
            professorIds.length
              ? { fromProfessor: { $in: professorIds } }
              : null,
            professorIds.length ? { toProfessor: { $in: professorIds } } : null,
          ].filter(Boolean),
        },
        { session }
      );

      // (Opcional) Si tenés un modelo de piezas, descomentá:
      const piecesDel = await Piece.deleteMany(
        { $or: [{ branch: branchObjId }, { branch: branchIdStr }] },
        { session }
      );

      // 3) Borrar usuarios (NO admins)
      const userDel = await User.deleteMany(
        { _id: { $in: userIds } },
        { session }
      );

      // 4) Borrar la branch
      const branchDel = await Branch.deleteOne(
        { _id: branchObjId },
        { session }
      );

      result = {
        usersDeleted: userDel.deletedCount || 0,
        enrollmentsDeleted: enrollDel.deletedCount || 0,
        schedulesDeleted: schedDel.deletedCount || 0,
        attendancesDeleted: attDel.deletedCount || 0,
        reschedulesDeleted: resDel.deletedCount || 0,
        piecesDeleted: piecesDel?.deletedCount || 0,
        branchDeleted: branchDel.deletedCount || 0,
      };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("DELETE /api/branches/[id] error:", err);
    // si la transacción falla, se revierte todo
    return NextResponse.json(
      { error: "No se pudo eliminar la sucursal", details: err?.message },
      { status: 500 }
    );
  } finally {
    session.endSession();
  }
}
