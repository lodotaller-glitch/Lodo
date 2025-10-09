// lib/calendar.js
import {
  ProfessorSchedule,
  Enrollment,
  User,
  StudentReschedule,
  Attendance,
} from "@/models"; // 👈 +StudentReschedule
import dbConnect from "./dbConnect";
import { slotKey } from "@/functions/slotKey";

/** Util: fechas útiles */
function startOfMonthUTC(year, month) {
  // month: 1..12
  return new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
}
function endOfMonthUTC(year, month) {
  // último día del mes a las 23:59:59.999 UTC
  return new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
}
// 👇 NUEVO: normaliza una fecha a medianoche UTC y devuelve ISO (clave de mapa)
function dateOnlyISO(d) {
  const only = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
  return only.toISOString();
}

/** Convierte dayOfWeek (0=Dom) a todas las fechas de ese mes que caen ese día */
function datesForWeekdayInMonth(year, month, dayOfWeek) {
  // month: 1..12 ; dayOfWeek: 0..6 (0=Dom, 1=Lun, 2=Mar, ...)
  const end = endOfMonthUTC(year, month);
  const first = new Date(Date.UTC(year, month - 1, 1));
  const offset = (dayOfWeek - first.getUTCDay() + 7) % 7;
  let d = new Date(Date.UTC(year, month - 1, 1 + offset));

  const result = [];
  const limit = dayOfWeek ? 4 : Infinity;

  while (d <= end) {
    result.push(new Date(d));
    if (result.length >= limit) break; // 👈 corta en la 4.ª ocurrencia
    d = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 7)
    );
  }
  return result;
}

function buildDateTimeUTC(dateOnlyUTC, minutesFromMidnight) {
  const h = Math.floor(minutesFromMidnight / 60);
  const m = minutesFromMidnight % 60;
  return new Date(
    Date.UTC(
      dateOnlyUTC.getUTCFullYear(),
      dateOnlyUTC.getUTCMonth(),
      dateOnlyUTC.getUTCDate(),
      h,
      m,
      0,
      0
    )
  );
}

/**
 * Vista PROFESOR: genera eventos del mes con disponibilidad.
 * Devuelve [{start,end,title,status,capacityLeft,slotKey,weekday}]
 * Ahora ajusta por reprogramaciones del mes (OUT/IN por día).
 */
export async function getProfessorMonthCalendar({ professorId, year, month }) {
  await dbConnect();

  const monthStart = startOfMonthUTC(year, month);
  const monthEnd = endOfMonthUTC(year, month);

  // 1) horario vigente
  const schedule = await ProfessorSchedule.findActiveForDate(
    professorId,
    monthStart
  );
  if (!schedule) return [];

  // 2) capacidad por franja (desde el User del profe)
  const prof = await User.findById(professorId).lean();
  const capacity = Number(prof?.capacity ?? 10);

  // 3) inscripciones activas de ese mes para ese profe (⚠️ fix de los $or)
  const enrollments = await Enrollment.find({
    professor: professorId,
    year,
    month,
    $and: [
      { state: "activa" },
      {
        $or: [{ assigned: true }, { assigned: { $exists: false } }],
      },
    ],
  })
    .select("chosenSlots")
    .lean();

  // 4) conteo base por (slotKey mensual, sin fecha)
  const countBySlot = new Map();
  for (const e of enrollments) {
    for (const s of e.chosenSlots || []) {
      const k = slotKey(s, String(professorId));
      countBySlot.set(k, (countBySlot.get(k) || 0) + 1);
    }
  }

  // 4.5) Reprogramaciones del mes de/para ESTE profe — por DÍA
  const reschedules = await StudentReschedule.find({
    $and: [
      {
        $or: [
          { fromProfessor: professorId },
          { toProfessor: professorId },
          { professor: professorId }, // compat legado
        ],
      },
      {
        $or: [
          { toDate: { $gte: monthStart, $lte: monthEnd } },
          { fromDate: { $gte: monthStart, $lte: monthEnd } },
          { $and: [{ year }, { month }] },
        ],
      },
    ],
  }).lean();

  const movedIn = new Map(); // `${pid}|${dateISO}|${slotKey}` -> n
  const movedOut = new Map(); // idem
  const inc = (map, k) => map.set(k, (map.get(k) || 0) + 1);

  const regularRemovedDocs = await Attendance.find({
    origin: { $in: [null, "regular"] }, // por compat
    professor: professorId,
    date: { $gte: monthStart, $lte: monthEnd },
    removed: true,
    slotSnapshot: { $exists: true }, // ya lo guardamos en DELETE
  })
    .select("date slotSnapshot")
    .lean();

  const regularRemoved = new Map(); // `${profId}|${dateISO}|${slotKey}` -> n

  for (const a of regularRemovedDocs) {
    if (!a.slotSnapshot) continue;
    const dayISO = dateOnlyISO(new Date(a.date));
    const k = slotKey(a.slotSnapshot, String(professorId));
    inc(regularRemoved, `${professorId}|${dayISO}|${k}`);
  }

  for (const r of reschedules) {
    if (
      r.toDate &&
      r.slotTo &&
      String(r.toProfessor || r.professor) === String(professorId)
    ) {
      const dayISO = dateOnlyISO(new Date(r.toDate));
      const kTo = slotKey(r.slotTo, String(professorId));
      inc(movedIn, `${professorId}|${dayISO}|${kTo}`);
    }
    if (
      r.fromDate &&
      r.slotFrom &&
      String(r.fromProfessor || r.professor) === String(professorId)
    ) {
      const dayISO = dateOnlyISO(new Date(r.fromDate));
      const kFrom = slotKey(r.slotFrom, String(professorId));
      inc(movedOut, `${professorId}|${dayISO}|${kFrom}`);
    }
  }

  // 4.6) 👇 ADHOC: asistencias ad-hoc del mes (cuentan contra la capacidad diaria)
  const adhocDocs = await Attendance.find({
    origin: "adhoc",
    professor: professorId,
    date: { $gte: monthStart, $lte: monthEnd },
    removed: { $ne: true },
  })
    .select("date slotSnapshot")
    .lean();

  const adhocIn = new Map(); // `${pid}|${dateISO}|${slotKey}` -> n
  for (const a of adhocDocs) {
    if (!a.slotSnapshot) continue;
    const dayISO = dateOnlyISO(new Date(a.date));
    const k = slotKey(a.slotSnapshot, String(professorId));
    inc(adhocIn, `${professorId}|${dayISO}|${k}`);
  }

  // 5) expandir a fechas del mes (takenDay = base - OUT + IN + ADHOC)
  const events = [];
  for (const s of schedule.slots) {
    const k = slotKey(s, String(professorId));
    const takenBase = countBySlot.get(k) || 0;

    const dates = datesForWeekdayInMonth(year, month, s.dayOfWeek);
    for (const day of dates) {
      const iso = dateOnlyISO(day);
      const outDay = movedOut.get(`${professorId}|${iso}|${k}`) || 0;
      const inDay = movedIn.get(`${professorId}|${iso}|${k}`) || 0;
      const adhocDay = adhocIn.get(`${professorId}|${iso}|${k}`) || 0; // 👈 nuevo
      const removedDay = regularRemoved.get(`${professorId}|${iso}|${k}`) || 0;

      const takenDay = Math.max(
        0,
        takenBase - outDay + inDay + adhocDay - removedDay
      );
      const left = Math.max(0, capacity - takenDay);

      events.push({
        title: `Clase (${takenDay}/${capacity})`,
        start: buildDateTimeUTC(day, s.startMin),
        end: buildDateTimeUTC(day, s.endMin),
        slotKey: k,
        weekday: s.dayOfWeek,
        status: left > 0 ? "available" : "full",
        capacityLeft: left,
        taken: takenDay,
        capacity,
      });
    }
  }

  return events.sort((a, b) => a.start - b.start);
}

export async function getStudentMonthCalendar({ studentId, year, month }) {
  await dbConnect();

  const monthStart = startOfMonthUTC(year, month);
  const monthEnd = endOfMonthUTC(year, month);

  // ——— helpers locales (solo para esta función) ———
  const DOW_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const strMin = (min) =>
    `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(
      min % 60
    ).padStart(2, "0")}`;

  const ATT_PRESENT = new Set([
    "present",
    "presente",
    "asistio",
    "asistió",
    "attended",
    "done",
    "completed",
  ]);
  const ATT_ABSENT = new Set([
    "absent",
    "ausente",
    "missed",
    "no_show",
    "no-show",
  ]);

  const dateOnlyISO = (d) => {
    const only = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
    );
    return only.toISOString();
  };
  const statusAttendanse = (status, startDate) => {
    if (!status) {
      if (startDate && startDate > new Date()) return false;
      return false;
    }
    const s = String(status).toLowerCase();
    if (ATT_PRESENT.has(s)) return true;
    if (ATT_ABSENT.has(s)) return false;
    return s;
  };
  const keyOf = (ev) => {
    const dIso = dateOnlyISO(new Date(ev.start));
    return `${dIso}|${ev.slot.startMin}|${ev.slot.endMin}`;
  };

  // ——— 1) inscripción activa del mes ———
  const enrollment = await Enrollment.findOne({
    student: studentId, // compat
    year,
    month,
    state: "activa",
  })
    .populate("professor", "name nombre")
    .lean();

  if (!enrollment) return [];

  const pid = enrollment.professor?._id?.toString() || "";

  // ——— 2) TODA la asistencia del estudiante en el mes (no solo adhoc) ———
  const attendanceDocs = await Attendance.find({
    student: studentId,
    date: { $gte: monthStart, $lte: monthEnd },
    // removed: { $ne: true },
  })
    .select("_id date slotSnapshot professor status origin removed")
    .lean();

  // Índice: `${dayISO}|${slotKey(slotSnapshot, profId)}`
  const attendanceByKey = new Map();
  for (const a of attendanceDocs) {
    if (!a.slotSnapshot) continue;
    if (a.removed === true) continue; // 👈 removed no aporta status

    const dayISO = dateOnlyISO(new Date(a.date));
    const pidFromAtt = a.professor ? String(a.professor) : "";
    const k = `${dayISO}|${slotKey(a.slotSnapshot, pidFromAtt)}`;

    attendanceByKey.set(k, {
      status: a.status,
      _id: String(a._id),
      origin: a.origin || null,
    });
  }

  const removedRegularKeys = new Set(); // `${profId}|${dayISO}|${slotKey}`
  for (const a of attendanceDocs) {
    if (
      a.removed === true &&
      a.slotSnapshot &&
      (a.origin === "regular" || !a.origin)
    ) {
      const dayISO = dateOnlyISO(new Date(a.date));
      const pidFromAtt = a.professor ? String(a.professor) : "";
      const k = `${pidFromAtt}|${dayISO}|${slotKey(
        a.slotSnapshot,
        pidFromAtt
      )}`;
      removedRegularKeys.add(k);
    }
  }
  // ——— 3) ocurrencias base (sin reprogramaciones) ———
  const base = [];
  for (const s of enrollment.chosenSlots || []) {
    const days = datesForWeekdayInMonth(year, month, s.dayOfWeek); // respeta el límite 4/semana si lo definiste arriba
    for (const day of days) {
      const start = buildDateTimeUTC(day, s.startMin);
      const dayISO = dateOnlyISO(day);
      const att = attendanceByKey.get(`${dayISO}|${slotKey(s, pid)}`);
      const status = statusAttendanse(att?.status, start);

      base.push({
        title: `${DOW_SHORT[s.dayOfWeek]} ${strMin(s.startMin)}–${strMin(
          s.endMin
        )}`,
        start,
        end: buildDateTimeUTC(day, s.endMin),
        professorId: pid || undefined,
        slot: s,
        slotKey: slotKey(s, pid),
        origin: "base",
        payment: enrollment.pay, // campo del modelo
        classState: status,
      });
    }
  }

  // ——— 4) reprogramaciones del alumno que toquen este mes ———
  const reschedules = await StudentReschedule.find({
    $and: [
      { student: studentId },
      {
        $or: [
          { toDate: { $gte: monthStart, $lte: monthEnd } },
          { fromDate: { $gte: monthStart, $lte: monthEnd } },
          { $and: [{ year }, { month }] },
        ],
      },
    ],
  }).lean();

  // OUT/IN
  const outKeys = new Set(); // `${profId}|${dayISO}|${slotKey}`
  const movedIn = [];

  for (const r of reschedules) {
    if (r.fromDate && r.slotFrom) {
      const fd = new Date(r.fromDate);
      if (fd >= monthStart && fd <= monthEnd) {
        const dayISO = dateOnlyISO(fd);
        const fromProf = String(r.fromProfessor || r.professor || pid);
        const kFrom = slotKey(r.slotFrom, fromProf);
        outKeys.add(`${fromProf}|${dayISO}|${kFrom}`);
      }
    }
    if (r.toDate && r.slotTo) {
      const td = new Date(r.toDate);
      if (td >= monthStart && td <= monthEnd) {
        const dayOnly = new Date(
          Date.UTC(td.getUTCFullYear(), td.getUTCMonth(), td.getUTCDate())
        );
        const toProf = String(r.toProfessor || r.professor || pid);

        const startTo = buildDateTimeUTC(dayOnly, r.slotTo.startMin);
        const toDayISO = dateOnlyISO(dayOnly);
        const attTo = attendanceByKey.get(
          `${toDayISO}|${slotKey(r.slotTo, toProf)}`
        );
        const status = statusAttendanse(attTo?.status, startTo);

        movedIn.push({
          title: `${DOW_SHORT[r.slotTo.dayOfWeek]} ${strMin(
            r.slotTo.startMin
          )}–${strMin(r.slotTo.endMin)} (reprogramada)`,
          start: startTo,
          end: buildDateTimeUTC(dayOnly, r.slotTo.endMin),
          professorId: toProf || undefined,
          slot: r.slotTo,
          slotKey: slotKey(r.slotTo, toProf),
          origin: "reschedule-in",
          payment: enrollment.pay,
          classState: status,
          rescheduleRef: {
            _id: String(r._id),
            fromDate: r.fromDate
              ? new Date(r.fromDate).toISOString()
              : undefined,
            toDate: new Date(r.toDate).toISOString(),
          },
        });
      }
    }
  }

  // ——— 5) eventos adhoc (desde Attendance con origin: "adhoc") ———
  const adhocIn = [];
  for (const a of attendanceDocs) {
    if (a.origin !== "adhoc" || !a.slotSnapshot) continue;
    if (a.removed === true) continue; // <-- importante: no incluir adhoc removidos

    const td = new Date(a.date);
    if (td < monthStart || td > monthEnd) continue;

    const dayOnly = new Date(
      Date.UTC(td.getUTCFullYear(), td.getUTCMonth(), td.getUTCDate())
    );
    const profId = a.professor ? String(a.professor) : "";
    const startAdhoc = buildDateTimeUTC(dayOnly, a.slotSnapshot.startMin);
    const status = statusAttendanse(a.status, startAdhoc);

    adhocIn.push({
      title: `${DOW_SHORT[a.slotSnapshot.dayOfWeek]} ${strMin(
        a.slotSnapshot.startMin
      )}–${strMin(a.slotSnapshot.endMin)} (adhoc)`,
      start: startAdhoc,
      end: buildDateTimeUTC(dayOnly, a.slotSnapshot.endMin),
      professorId: profId || undefined,
      slot: a.slotSnapshot,
      classState: status,
      slotKey: slotKey(a.slotSnapshot, profId),
      origin: "adhoc",
      payment: enrollment.pay,
      attendanceRef: { _id: String(a._id), status: a.status },
    });
  }

  // ——— 6) filtrar base removiendo OUT ———
  const baseFiltered = base.filter((ev) => {
    const dayISO = dateOnlyISO(new Date(ev.start));
    const key = `${ev.professorId || ""}|${dayISO}|${ev.slotKey}`;
    return !outKeys.has(key) && !removedRegularKeys.has(key); // 👈 agrega este chequeo
  });

  // ——— 7) combinar con prioridad y desduplicar por día+horario ———
  const priority = { "reschedule-in": 3, adhoc: 2, base: 1 };
  const byKey = new Map(); // keyOf(ev) => ev
  const put = (ev) => {
    const k = keyOf(ev);
    const cur = byKey.get(k);
    if (!cur || priority[ev.origin] > priority[cur.origin]) {
      byKey.set(k, ev);
    }
  };

  for (const ev of baseFiltered) put(ev);
  for (const ev of adhocIn) put(ev);
  for (const ev of movedIn) put(ev);

  const events = Array.from(byKey.values()).sort(
    (a, b) => new Date(a.start) - new Date(b.start)
  );

  // ——— 8) normalizar fechas a ISO ———
  return events.map((ev) => ({
    ...ev,
    start: new Date(ev.start).toISOString(),
    end: new Date(ev.end).toISOString(),
  }));
}
