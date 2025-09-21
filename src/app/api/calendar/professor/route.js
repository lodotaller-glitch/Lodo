// app/api/calendario/profesor/route.js
import { getProfessorMonthCalendar } from "@/lib/calendar";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const professorId = searchParams.get("professorId")?.trim();
    const year = Number(searchParams.get("year"));
    const month = Number(searchParams.get("month"));

    // Validaciones básicas
    if (!professorId) {
      return Response.json({ error: "Falta professorId" }, { status: 400 });
    }
    if (!Number.isInteger(year) || !Number.isInteger(month)) {
      return Response.json(
        { error: "Parámetros year y month inválidos" },
        { status: 400 }
      );
    }
    if (month < 1 || month > 12) {
      return Response.json(
        { error: "month debe estar entre 1 y 12" },
        { status: 400 }
      );
    }

    const events = await getProfessorMonthCalendar({
      professorId,
      year,
      month,
    });

    return Response.json({ events }, { status: 200 });
  } catch (err) {
    console.error("GET /api/calendario/profesor error:", err);
    return Response.json(
      { error: "Error del servidor", details: err?.message },
      { status: 500 }
    );
  }
}
