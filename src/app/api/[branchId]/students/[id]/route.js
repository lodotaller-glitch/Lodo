// app/api/[branchId]/students/[id]/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import mongoose from "mongoose";
import { User, Enrollment, StudentReschedule, Attendance } from "@/models";

export const runtime = "nodejs"; // necesitamos Node para transacciones

function toObjId(v) {
  try {
    return new mongoose.Types.ObjectId(String(v));
  } catch {
    return null;
  }
}

export async function DELETE(_req, { params }) {
  await dbConnect();

  const { branchId, id } = (await params) || {};
  const studentId = toObjId(id);
  const branchObjId = toObjId(branchId);
  const branchStr = String(branchId);

  if (!studentId) {
    return NextResponse.json(
      { error: "ID de alumno inválido" },
      { status: 400 }
    );
  }

  const session = await mongoose.startSession();
  try {
    let result = {};
    await session.withTransaction(async () => {
      // 1) Traer alumno y validar
      const student = await User.findOne({
        _id: studentId,
        $or: [{ branch: branchObjId }, { branch: branchStr }],
      })
        .session(session)
        .lean();

      if (!student) {
        throw new Error("Alumno no encontrado en esta sucursal");
      }
      if (student.role === "admin") {
        throw new Error("No se puede eliminar un usuario admin");
      }

      // 2) Borrar documentos relacionados
      const enrollDel = await Enrollment.deleteMany(
        {
          student: studentId,
          $or: [{ branch: branchObjId }, { branch: branchStr }],
        },
        { session }
      );

      const attDel = await Attendance.deleteMany(
        {
          student: studentId,
          $or: [{ branch: branchObjId }, { branch: branchStr }],
        },
        { session }
      );

      const resDel = await StudentReschedule.deleteMany(
        { student: studentId },
        { session }
      );

      // 2.1) Intentar borrar piezas si existe el modelo
      let piecesDeleted = 0;
      try {
        const mod = await import("@/models/Piece");
        const Piece = mod.default || mod.Piece;
        if (Piece) {
          const del = await Piece.deleteMany(
            {
              $or: [{ student: studentId }, { estudiante: studentId }],
            },
            { session }
          );
          piecesDeleted = del.deletedCount || 0;
        }
      } catch {
        // no hay modelo Piece, ignorar
      }

      // 3) Borrar el usuario
      const userDel = await User.deleteOne({ _id: studentId }, { session });

      result = {
        userDeleted: userDel.deletedCount || 0,
        enrollmentsDeleted: enrollDel.deletedCount || 0,
        attendancesDeleted: attDel.deletedCount || 0,
        reschedulesDeleted: resDel.deletedCount || 0,
        piecesDeleted,
      };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("DELETE /api/[branchId]/students/[id] error:", err);
    return NextResponse.json(
      { error: "No se pudo eliminar el alumno", details: err?.message },
      { status: 500 }
    );
  } finally {
    session.endSession();
  }
}

export async function GET(_req, { params }) {
  try {
    await dbConnect();
    const { id } = await params;

    const user = await User.findById(id)
      .select(
        "name email role state capacity clayKg branch createdAt updatedAt"
      )
      .lean();
    if (!user)
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    return NextResponse.json({ user });
  } catch (err) {
    console.error("GET /api/users/[id]", err);
    return NextResponse.json(
      { error: "Error del servidor", details: err?.message },
      { status: 500 }
    );
  }
}

export async function PUT(req, { params }) {
  try {
    await dbConnect();
    const { id } = await params;
    const body = await req.json();
    const { name, email, role, state, capacity, clayKg, password } = body || {};

    const user = await User.findById(id);
    if (!user)
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );

    if (email && email !== user.email) {
      const exists = await User.findOne({
        email: email.toLowerCase(),
        _id: { $ne: id },
      }).lean();
      if (exists)
        return NextResponse.json(
          { error: "Ese email ya está en uso" },
          { status: 409 }
        );
      user.email = email.toLowerCase();
    }

    if (name !== undefined) user.name = name;
    if (role !== undefined) user.role = role; // si querés, podés restringir cambios de rol
    if (state !== undefined) user.state = Boolean(state);
    if (capacity !== undefined) user.capacity = Math.max(1, Number(capacity));
    if (clayKg != null) {
      const val = Number(clayKg);
      if (!Number.isNaN(val)) user.clayKg = Math.max(0, val);
    }
    if (password) user.passwordHash = password;

    await user.save();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PUT /api/users/[id]", err);
    return NextResponse.json(
      { error: "Error del servidor", details: err?.message },
      { status: 500 }
    );
  }
}
