import { NextResponse as ____NR } from "next/server";
import dbConnect from "@/lib/dbConnect";
import {
  Enrollment,
  ProfessorSchedule,
  StudentReschedule,
  Attendance,
  DisabledClass,
} from "@/models";
import { slotKey } from "@/functions/slotKey";

function isFifthUTC(d) {
  const dow = d.getUTCDay();
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const first = new Date(Date.UTC(y, m, 1));
  const offset = (dow - first.getUTCDay() + 7) % 7;
  const firstDowDay = 1 + offset;
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
        { status: 404 },
      );

    const fromDate = new Date(from);
    const windowStart = new Date(fromDate);
    const windowEnd = new Date(fromDate);
    windowStart.setUTCDate(windowStart.getUTCDate() - 7);
    windowEnd.setUTCDate(windowEnd.getUTCDate() + 7);

    const now = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const startOfTodayUTC = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );

    // ===============================
    // 1) Inscripciones activas del alumno
    // ===============================

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

    const occupiedByProf = new Map();
    studentEns.forEach((e) => {
      const pid = String(e.professor);
      const arr = occupiedByProf.get(pid) || [];
      e.chosenSlots?.forEach((cs) => arr.push(cs));
      occupiedByProf.set(pid, arr);
    });

    // ===============================
    // 2) Disabled classes
    // ===============================

    const disabledDocs = await DisabledClass.find({
      start: {
        $gte: windowStart.toISOString(),
        $lte: windowEnd.toISOString(),
      },
    }).lean();

    const disabledKeys = new Set(disabledDocs.map((d) => d.key));

    // ===============================
    // 3) Schedules (FIX IMPORTANTE)
    // effectiveTo exclusivo
    // ===============================

    const sched = await ProfessorSchedule.find({
      branch: branchId,
      effectiveFrom: { $lt: windowEnd }, // 👈 exclusivo
      $or: [
        { effectiveTo: null },
        { effectiveTo: { $gt: windowStart } }, // 👈 exclusivo
      ],
    })
      .populate("professor")
      .lean();

    // ===============================
    // 4) Generación de días candidatos
    // ===============================

    const days = [];
    const seen = new Set(); // 👈 deduplicación real

    let iter = new Date(windowStart);

    while (iter <= windowEnd) {
      const dayEnd = new Date(
        Date.UTC(
          iter.getUTCFullYear(),
          iter.getUTCMonth(),
          iter.getUTCDate(),
          23,
          59,
          59,
          999,
        ),
      );

      if (dayEnd <= now || isFifthUTC(iter)) {
        iter.setUTCDate(iter.getUTCDate() + 1);
        continue;
      }

      for (const sch of sched) {
        const profIdStr = String(sch.professor?._id || "");
        const alreadySlots = occupiedByProf.get(profIdStr) || [];

        for (const s of sch.slots) {
          if (s.dayOfWeek !== iter.getUTCDay()) continue;

          const yaEsta = alreadySlots.some(
            (cs) =>
              cs.dayOfWeek === s.dayOfWeek &&
              cs.startMin === s.startMin &&
              cs.endMin === s.endMin,
          );

          if (yaEsta) continue;

          const start = new Date(
            Date.UTC(
              iter.getUTCFullYear(),
              iter.getUTCMonth(),
              iter.getUTCDate(),
              Math.floor(s.startMin / 60),
              s.startMin % 60,
            ),
          );

          if (start <= startOfTodayUTC) continue;

          const uniqueKey = `${profIdStr}_${start.toISOString()}_${s.startMin}_${s.endMin}`;

          if (seen.has(uniqueKey)) continue; // 👈 evita duplicados

          seen.add(uniqueKey);

          const end = new Date(
            Date.UTC(
              iter.getUTCFullYear(),
              iter.getUTCMonth(),
              iter.getUTCDate(),
              Math.floor(s.endMin / 60),
              s.endMin % 60,
            ),
          );

          days.push({
            to: start.toISOString(),
            endISO: end.toISOString(),
            slotTo: s,
            capacity: sch.professor?.capacity || 10,
            professorId: profIdStr,
            branchId,
          });
        }
      }

      iter.setUTCDate(iter.getUTCDate() + 1);
    }

    // ===============================
    // 5) Cálculo de capacidad
    // ===============================

    const results = await Promise.all(
      days.map(async (d) => {
        const start = new Date(d.to);
        const y = start.getUTCFullYear();
        const m = start.getUTCMonth() + 1;

        const slotMatch = {
          dayOfWeek: d.slotTo.dayOfWeek,
          startMin: d.slotTo.startMin,
          endMin: d.slotTo.endMin,
        };

        const base = await Enrollment.countDocuments({
          professor: d.professorId,
          year: y,
          month: m,
          state: "activa",
          assigned: true,
          chosenSlots: { $elemMatch: slotMatch },
        });

        const movedOut = await StudentReschedule.countDocuments({
          fromProfessor: d.professorId,
          fromDate: start,
          slotFrom: slotMatch,
        });

        const movedIn = await StudentReschedule.countDocuments({
          toProfessor: d.professorId,
          toDate: start,
          slotTo: slotMatch,
        });

        const adhocAdded = await Attendance.countDocuments({
          origin: "adhoc",
          removed: false,
          professor: d.professorId,
          branch: d.branchId,
          date: start,
          slotSnapshot: slotMatch,
        });

        const adhocRemoved = await Attendance.countDocuments({
          origin: "adhoc",
          removed: true,
          professor: d.professorId,
          branch: d.branchId,
          date: start,
          slotSnapshot: slotMatch,
        });

        const adhocNet = Math.max(0, adhocAdded - adhocRemoved);
        const effective = Math.max(0, base - movedOut) + movedIn + adhocNet;

        const cap = d.capacity ?? 0;
        const capacityLeft = Math.max(0, cap - effective);

        const key = `${start.toISOString()}_${slotKey(
          d.slotTo,
          d.professorId,
        )}`;

        const disabled = disabledKeys.has(key);

        return {
          ...d,
          capacityLeft,
          disabled,
          status: capacityLeft > 0 ? "available" : "full",
        };
      }),
    );

    return ____NR.json({ options: results });
  } catch (err) {
    console.error("GET /student-reschedules/options", err);
    return ____NR.json({ error: "Error del servidor" }, { status: 500 });
  }
}
