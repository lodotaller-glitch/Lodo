// app/api/calendario/estudiante/route.js
import { getStudentMonthCalendar } from "@/lib/calendar";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const studentId =
      searchParams.get("studentId")?.trim() ||
      searchParams.get("estudianteId")?.trim(); // compat

    const year = Number(searchParams.get("year"));
    const month = Number(searchParams.get("month"));

    // Validaciones
    if (!studentId) {
      return Response.json({ error: "Falta studentId" }, { status: 400 });
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

    const events = await getStudentMonthCalendar({
      studentId,
      year,
      month,
    });


    return Response.json({ events }, { status: 200 });
  } catch (err) {
    console.error("GET /api/calendario/estudiante error:", err);
    return Response.json(
      { error: "Error del servidor", details: err?.message },
      { status: 500 }
    );
  }
}
