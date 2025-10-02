// app/api/slots/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import { User, ProfessorSchedule } from "@/models";

// Utilidad: primer día del mes en UTC
function startOfMonthUTC(year, month) {
  return new Date(Date.UTC(Number(year), Number(month) - 1, 1, 0, 0, 0, 0));
}

export async function GET(req, { params }) {
  try {
    await dbConnect();
    const url = new URL(req.url);
    const year = Number(url.searchParams.get("year"));
    const month = Number(url.searchParams.get("month"));
    const professorIdsParam = url.searchParams.get("professorIds"); // opcional: "id1,id2,..."
    const { branchId } = await params;

    if (
      !Number.isInteger(year) ||
      !Number.isInteger(month) ||
      month < 1 ||
      month > 12
    ) {
      return NextResponse.json(
        { error: "Parámetros 'year' y 'month' inválidos" },
        { status: 400 }
      );
    }

    // Si vienen ids, filtramos; si no, tomamos todos los profesores activos
    const filter = { role: "professor", state: true, branch:branchId };
    if (professorIdsParam) {
      const ids = professorIdsParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      filter._id = { $in: ids };
    }

    const professors = await User.find(filter, { name: 1 }).lean();

    const monthStart = startOfMonthUTC(year, month);
    const results = [];

    // Para cada profesor, tomamos el schedule vigente en ese mes
    for (const prof of professors) {
      const schedule = await ProfessorSchedule.findActiveForDate(
        prof._id,
        monthStart
      );
      if (!schedule?.slots?.length) continue;

      for (const s of schedule.slots) {
        results.push({
          professorId: String(prof._id),
          professorName: prof.name,
          dayOfWeek: s.dayOfWeek,
          startMin: s.startMin,
          endMin: s.endMin,
          slotKey: `${prof._id}-${s.dayOfWeek}-${s.startMin}-${s.endMin}`, // útil para selección
        });
      }
    }

    // Devolvemos slots planos (uno por franja por profesor)
    return NextResponse.json({ slots: results }, { status: 200 });
  } catch (err) {
    console.error("GET /api/slots error:", err);
    return NextResponse.json(
      { error: "Error del servidor", details: err?.message },
      { status: 500 }
    );
  }
}
