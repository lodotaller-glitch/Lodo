import { NextResponse as ____NR } from "next/server";
import dbConnect from "@/lib/dbConnect";
import { Enrollment, ProfessorSchedule } from "@/models";

function isFifthUTC(d) {
  const dow = d.getUTCDay();

  const y = d.getUTCFullYear();
  const m = d.getUTCMonth(); // 0-based
  const first = new Date(Date.UTC(y, m, 1));
  const offset = (dow - first.getUTCDay() + 7) % 7;
  const firstDowDay = 1 + offset; // día del mes del 1.er Lun/Mar
  const nth = 1 + Math.floor((d.getUTCDate() - firstDowDay) / 7);
  return nth >= 5;
}

export async function GET(req, { params }) {
  try {
    await dbConnect();
    const url = new URL(req.url);
    const enrollmentId = url.searchParams.get("enrollmentId");
    const from = url.searchParams.get("from");
    const { branchId } = await params;

    if (!enrollmentId || !from)
      return ____NR.json({ error: "Faltan parámetros" }, { status: 400 });

    const en = await Enrollment.findById(enrollmentId).lean();
    if (!en)
      return ____NR.json(
        { error: "Inscripción no encontrada" },
        { status: 404 }
      );

    const fromDate = new Date(from);
    const windowStart = new Date(fromDate);
    const windowEnd = new Date(fromDate);

    windowStart.setUTCDate(windowStart.getUTCDate() - 7); // 7 días antes
    windowEnd.setUTCDate(windowEnd.getUTCDate() + 7); // 7 días después

    const now = new Date(); // Fecha actual

    // ===== 1) Índice de slots donde el estudiante YA está =====
    const months = new Set([
      `${fromDate.getUTCFullYear()}-${fromDate.getUTCMonth() + 1}`,
      `${windowEnd.getUTCFullYear()}-${windowEnd.getUTCMonth() + 1}`,
    ]);
    const monthsOr = Array.from(months).map((ym) => {
      const [y, m] = ym.split("-").map(Number);
      return { year: y, month: m };
    });

    const studentEns = await Enrollment.find({
      student: en.student,
      state: "activa",
      assigned: true,
      $or: monthsOr,
    })
      .select("professor chosenSlots")
      .lean();

    // Mapa: professorId -> array de {dayOfWeek, startMin, endMin} donde YA está el estudiante
    const occupiedByProf = new Map();
    studentEns.forEach((e) => {
      const pid = String(e.professor);
      const arr = occupiedByProf.get(pid) || [];
      e.chosenSlots?.forEach((cs) => arr.push(cs));
      occupiedByProf.set(pid, arr);
    });

    // ===== 2) Construcción de candidatos (excluyendo donde ya está) =====
    const days = [];
    const iterStart = new Date(windowStart);

    // Pre-cargar horarios de los profesores para todo el rango
    const sched = await ProfessorSchedule.find({
      branch: branchId,
      effectiveFrom: { $lte: windowEnd },
      $or: [{ effectiveTo: null }, { effectiveTo: { $gt: iterStart } }],
    })
      .populate("professor")
      .lean();

    const profSchedulesMap = new Map();
    sched.forEach((sch) => {
      const profIdStr = String(sch.professor?._id || "");
      if (!profSchedulesMap.has(profIdStr)) profSchedulesMap.set(profIdStr, []);
      profSchedulesMap.get(profIdStr).push(sch);
    });

    // Iteramos sobre el rango de fechas
    let iter = new Date(iterStart);
    while (iter <= windowEnd) {
      if (iter < now || isFifthUTC(iter)) {
        iter.setUTCDate(iter.getUTCDate() + 1);
        continue;
      }

      // Buscamos los horarios de los profesores para el día actual
      const currentDaySchedules = sched.filter((sch) => {
        return sch.slots.some((s) => s.dayOfWeek === iter.getUTCDay());
      });

      // Para cada horario de profesor, comprobamos los slots
      for (const sch of currentDaySchedules) {
        const profIdStr = String(sch.professor?._id || "");
        const alreadySlots = occupiedByProf.get(profIdStr) || [];

        for (const s of sch.slots) {
          if (s.dayOfWeek !== iter.getUTCDay()) continue;

          // Si el estudiante ya está en este mismo profesor + slot semanal, lo excluimos
          const yaEsta = alreadySlots.some(
            (cs) =>
              cs.dayOfWeek === s.dayOfWeek &&
              cs.startMin === s.startMin &&
              cs.endMin === s.endMin
          );
          if (yaEsta) continue;

          const start = new Date(
            Date.UTC(
              iter.getUTCFullYear(),
              iter.getUTCMonth(),
              iter.getUTCDate(),
              Math.floor(s.startMin / 60),
              s.startMin % 60
            )
          );
          const end = new Date(
            Date.UTC(
              iter.getUTCFullYear(),
              iter.getUTCMonth(),
              iter.getUTCDate(),
              Math.floor(s.endMin / 60),
              s.endMin % 60
            )
          );

          if (start <= now) continue; // Excluir slots pasados

          days.push({
            to: start.toISOString(),
            endISO: end.toISOString(),
            slotTo: s,
            capacity: sch.professor?.capacity || 10,
            professorId: profIdStr,
          });
        }
      }

      iter.setUTCDate(iter.getUTCDate() + 1); // Avanzar al siguiente día
    }

    // ===== 3) Capacidad por candidato (contar por profesor correcto) =====
    const results = await Promise.all(
      days.map(async (d) => {
        const y = new Date(d.to).getUTCFullYear();
        const m = new Date(d.to).getUTCMonth() + 1;
        const same = await Enrollment.countDocuments({
          professor: d.professorId,
          year: y,
          month: m,
          state: "activa",
          assigned: true,
          chosenSlots: { $elemMatch: d.slotTo }, // Coincide ese slot semanal
        });
        const capacityLeft = Math.max(0, (d.capacity ?? 0) - same);
        return {
          ...d,
          capacityLeft,
          status: capacityLeft > 0 ? "available" : "full",
        };
      })
    );

    return ____NR.json({ options: results });
  } catch (err) {
    console.error("GET /student-reschedules/options", err);
    return ____NR.json({ error: "Error del servidor" }, { status: 500 });
  }
}
