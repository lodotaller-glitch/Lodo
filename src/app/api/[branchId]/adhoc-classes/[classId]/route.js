import dbConnect from "@/lib/dbConnect";
import { Attendance } from "@/models";
import AdhocClass from "@/models/AdhocClass";
import { NextResponse } from "next/server";

export async function DELETE(req, { params }) {
  try {
    await dbConnect();
    const { classId } = await params;

    if (!classId) {
      return NextResponse.json(
        { error: "professorId y classId requeridos" },
        { status: 400 }
      );
    }

    const adhocClass = await AdhocClass.findOne({
      _id: classId,
      removed: { $ne: true },
    });

    if (!adhocClass) {
      return NextResponse.json(
        { error: "Clase no encontrada o ya eliminada" },
        { status: 404 }
      );
    }

    // 🔹 En lugar de eliminar físicamente, marcamos como removida
    adhocClass.removed = true;
    adhocClass.modifiedAt = new Date();
    adhocClass.modifiedBy = req.headers.get("x-user-id") || undefined;
    await adhocClass.save();

    // 🔹 Marcamos las asistencias relacionadas como removed
    await Attendance.updateMany(
      { adhocClass: adhocClass._id, removed: { $ne: true } },
      {
        $set: {
          removed: true,
          modifiedAt: new Date(),
        },
      }
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("delete adhoc error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
