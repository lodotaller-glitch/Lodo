// app/api/professors/classes/route.js
import { NextResponse } from "next/server";
import { Enrollment, ProfessorSchedule, User } from "@/models";
import dbConnect from "@/lib/dbConnect";

export async function GET(req, { params }) {
  try {
    await dbConnect();
    const { branchId } = await params;
    const { searchParams } = new URL(req.url);
    const year = parseInt(searchParams.get("year"));
    const month = parseInt(searchParams.get("month"));
    const assigned = searchParams.get("assigned") || "true";
    const professorId = searchParams.get("professor");
    if (!year || !month) {
      return NextResponse.json(
        { error: "Debes indicar year y month en la consulta" },
        { status: 400 }
      );
    }

    const startOfMonth = new Date(Date.UTC(year, month - 1, 1));

    // 📅 Filtrar los schedules que estén vigentes en ese mes
    const scheduleFilter = {
      branch: branchId,
      effectiveFrom: { $lte: startOfMonth },
      $or: [{ effectiveTo: null }, { effectiveTo: { $gte: startOfMonth } }],
    };

    if (professorId) scheduleFilter.professor = professorId;
    const schedules = await ProfessorSchedule.find(scheduleFilter)
      .populate("professor", "name email")
      .lean();

    if (schedules.length === 0) {
      return NextResponse.json([]);
    }

    const result = [];

    for (const sch of schedules) {
      const { professor, slots } = sch;

      for (const slot of slots) {
        const { dayOfWeek, startMin, endMin } = slot;

        // 📊 Buscar inscripciones activas que coincidan
        const count = await Enrollment.countDocuments({
          professor: professor._id,
          year,
          month,
          assigned: assigned !== "false" ? true : false,
          state: "activa",
          "chosenSlots.dayOfWeek": dayOfWeek,
          "chosenSlots.startMin": startMin,
          "chosenSlots.endMin": endMin,
        });

        result.push({
          professor,
          dayOfWeek,
          startMin,
          endMin,
          studentsCount: count,
        });
      }
    }
    // 🧩 Eliminar duplicados por seguridad
    const unique = {};
    for (const r of result) {
      const key = `${r.professor._id}-${r.dayOfWeek}-${r.startMin}-${r.endMin}`;
      if (!unique[key]) {
        unique[key] = r;
      }
    }

    return NextResponse.json(Object.values(unique));
  } catch (err) {
    console.error("Error en /api/professors/classes:", err);
    return NextResponse.json(
      { error: "Error al obtener las clases" },
      { status: 500 }
    );
  }
}
