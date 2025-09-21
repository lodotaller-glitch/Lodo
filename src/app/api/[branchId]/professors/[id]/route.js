import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import {
  User,
  ProfessorSchedule,
  Enrollment,
  StudentReschedule,
  Attendance,
} from "@/models";
import mongoose from "mongoose";

const toId = (v) => {
  try {
    return new mongoose.Types.ObjectId(String(v));
  } catch {
    return null;
  }
};

export async function DELETE(req, { params }) {
  try {
    await dbConnect();
    const { branchId, id } = await params || {};
    const profId = toId(id);
    const branchObjId = toId(branchId);

    if (!profId || !branchObjId) {
      return NextResponse.json(
        { error: "Parámetros inválidos" },
        { status: 400 }
      );
    }

    // 1) Verificar que sea profesor de esta branch
    const professor = await User.findOne({
      _id: profId,
      branch: branchObjId,
    }).lean();
    if (!professor) {
      return NextResponse.json(
        { error: "Profesor no encontrado" },
        { status: 404 }
      );
    }
    if (String(professor.role) !== "professor") {
      return NextResponse.json(
        { error: "El usuario no es profesor" },
        { status: 400 }
      );
    }

    // 2) Borrar TODO lo relacionado al profesor (en esta branch)
    const [enrollRes, scheduleRes, attendanceRes, reschedRes] =
      await Promise.all([
        // Inscripciones del profesor en la sucursal
        Enrollment.deleteMany({ professor: profId, branch: branchObjId }),
        // Horarios del profesor en la sucursal
        ProfessorSchedule.deleteMany({
          professor: profId,
          branch: branchObjId,
        }),
        // Asistencias del profesor en la sucursal
        Attendance.deleteMany({ professor: profId, branch: branchObjId }),
        // Reprogramaciones en cualquier sucursal (modelo a veces no guarda branch)
        StudentReschedule.deleteMany({
          $or: [
            { fromProfessor: profId },
            { toProfessor: profId },
            { professor: profId }, // compat legado
          ],
        }),
      ]);

    // 3) Borrar el usuario profesor
    const userRes = await User.deleteOne({
      _id: profId,
      branch: branchObjId,
      role: "professor",
    });

    return NextResponse.json({
      ok: true,
      deleted: {
        user: userRes.deletedCount || 0,
        enrollments: enrollRes.deletedCount || 0,
        schedules: scheduleRes.deletedCount || 0,
        attendances: attendanceRes.deletedCount || 0,
        reschedules: reschedRes.deletedCount || 0,
      },
    });
  } catch (err) {
    console.error("DELETE /api/[branchId]/professors/[id] error:", err);
    return NextResponse.json(
      { error: "Error del servidor", details: err?.message },
      { status: 500 }
    );
  }
}

export async function GET(_req, { params }) {
  try {
    await dbConnect();
    const { id } = await params;

    const user = await User.findById(id)
      .select("name email role state capacity")
      .lean();
    if (!user)
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    return NextResponse.json({ user });
  } catch (err) {
    console.error("GET /api/professors/[id]", err);
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
    const { name, email, role, state, capacity } = body || {};

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

    await user.save();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PUT /api/professors/[id]", err);
    return NextResponse.json(
      { error: "Error del servidor", details: err?.message },
      { status: 500 }
    );
  }
}
