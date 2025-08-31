// lib/calendar.js
import {
  ProfessorSchedule,
  Enrollment,
  User,
  StudentReschedule,
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
  const start = startOfMonthUTC(year, month);
  const end = endOfMonthUTC(year, month);
  const result = [];

  // buscá el primer dayOfWeek del mes
  const first = new Date(Date.UTC(year, month - 1, 1));
  const offset = (dayOfWeek - first.getUTCDay() + 7) % 7;
  let d = new Date(Date.UTC(year, month - 1, 1 + offset));

  while (d <= end) {
    result.push(new Date(d)); // clone
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
  const capacity = Number(prof?.capacity ?? prof?.capacidadPorFranja ?? 10);

  // 3) inscripciones activas de ese mes para ese profe
  const enrollments = await Enrollment.find({
    professor: professorId,
    year,
    month,
    $or: [{ state: "activa" }, { estado: "activa" }],
    $or: [
      { assigned: true },
      { asignado: true },
      { assigned: { $exists: false }, asignado: { $exists: false } },
    ], // robusto
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
          { $and: [{ year }, { month }] }, // por si guardás también year/month
        ],
      },
    ],
  }).lean();

  const movedIn = new Map(); // key: `${pid}|${dateISO}|${slotKey}`
  const movedOut = new Map(); // key: idem
  const inc = (map, k) => map.set(k, (map.get(k) || 0) + 1);

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

  // 5) expandir a fechas del mes (ajustando taken por día: base - OUT + IN)
  const events = [];
  for (const s of schedule.slots) {
    const k = slotKey(s, String(professorId));
    const takenBase = countBySlot.get(k) || 0;

    const dates = datesForWeekdayInMonth(year, month, s.dayOfWeek);
    for (const day of dates) {
      const iso = dateOnlyISO(day);
      const outDay = movedOut.get(`${professorId}|${iso}|${k}`) || 0;
      const inDay = movedIn.get(`${professorId}|${iso}|${k}`) || 0;

      const takenDay = Math.max(0, takenBase - outDay + inDay);
      const left = Math.max(0, capacity - takenDay);

      events.push({
        title: `Clase (${takenDay}/${capacity})`,
        start: buildDateTimeUTC(day, s.startMin),
        end: buildDateTimeUTC(day, s.endMin),
        slotKey: k,
        weekday: s.dayOfWeek,
        status: left > 0 ? "available" : "full",
        capacityLeft: left,
        taken: takenDay, // 👈 útil para front
        capacity, // 👈 útil para front
      });
    }
  }

  return events.sort((a, b) => a.start - b.start);
}

/**
 * Vista ESTUDIANTE: sus clases del mes (base + reprogramadas).
 * Devuelve [{start,end,title,professorId,slotKey,origin,payment,...}]
 */
export async function getStudentMonthCalendar({ studentId, year, month }) {
  await dbConnect();

  const monthStart = startOfMonthUTC(year, month);
  const monthEnd = endOfMonthUTC(year, month);

  // 1) inscripción activa del mes
  const enrollment = await Enrollment.findOne({
    $or: [{ student: studentId }, { estudiante: studentId }], // compat
    year,
    month,
    $or: [{ state: "activa" }, { estado: "activa" }],
  })
    .populate("professor", "name nombre")
    .lean();

  if (!enrollment) return [];

  const pid = enrollment.professor?._id?.toString() || "";
  const profName =
    enrollment.professor?.name || enrollment.professor?.nombre || "Profesor";

  // 2) ocurrencias base (sin reprogramaciones)
  const base = [];
  for (const s of enrollment.chosenSlots || []) {
    const dates = datesForWeekdayInMonth(year, month, s.dayOfWeek);
    for (const day of dates) {
      base.push({
        title: `Clase con ${profName}`,
        start: buildDateTimeUTC(day, s.startMin),
        end: buildDateTimeUTC(day, s.endMin),
        professorId: pid || undefined,
        slot: s, // para machear OUT
        slotKey: slotKey(s, pid),
        origin: "base",
        payment: enrollment.pago, // {estado, metodo, ...}
      });
    }
  }

  // 3) reprogramaciones del alumno que toquen este mes (por fecha)
  const reschedules = await StudentReschedule.find({
    $and: [
      { $or: [{ student: studentId }, { estudiante: studentId }] }, // compat
      {
        $or: [
          { toDate: { $gte: monthStart, $lte: monthEnd } },
          { fromDate: { $gte: monthStart, $lte: monthEnd } },
          { $and: [{ year }, { month }] }, // si además guardás year/month
        ],
      },
    ],
  }).lean();

  // 4) construir OUT/IN
  const outKeys = new Set(); // `${profId}|${dayISO}|${slotKey}`
  const movedIn = [];

  for (const r of reschedules) {
    // OUT: sacamos la ocurrencia del día original si cae en el mes
    if (r.fromDate && r.slotFrom) {
      const fd = new Date(r.fromDate);
      if (fd >= monthStart && fd <= monthEnd) {
        const dayISO = dateOnlyISO(fd);
        const fromProf = String(r.fromProfessor || r.professor || pid);
        const kFrom = slotKey(r.slotFrom, fromProf);
        outKeys.add(`${fromProf}|${dayISO}|${kFrom}`);
      }
    }
    // IN: agregamos la nueva ocurrencia si cae en el mes
    if (r.toDate && r.slotTo) {
      const td = new Date(r.toDate);
      if (td >= monthStart && td <= monthEnd) {
        const dayOnly = new Date(
          Date.UTC(td.getUTCFullYear(), td.getUTCMonth(), td.getUTCDate())
        );
        const toProf = String(r.toProfessor || r.professor || pid);
        const profNameTo = toProf === pid ? profName : "Profesor";
        movedIn.push({
          title: `Clase con ${profNameTo} (reprogramada)`,
          start: buildDateTimeUTC(dayOnly, r.slotTo.startMin),
          end: buildDateTimeUTC(dayOnly, r.slotTo.endMin),
          professorId: toProf || undefined,
          slot: r.slotTo,
          slotKey: slotKey(r.slotTo, toProf),
          origin: "reschedule-in",
          payment: enrollment.pago,
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

  // 5) filtramos base removiendo OUT (coincidencia por día y horario)
  const baseFiltered = base.filter((ev) => {
    const dayISO = dateOnlyISO(new Date(ev.start));
    const key = `${ev.professorId || ""}|${dayISO}|${ev.slotKey}`;
    return !outKeys.has(key);
  });

  // 6) combinamos y normalizamos a ISO string (si tu front lo espera así)
  const events = [...baseFiltered, ...movedIn].sort(
    (a, b) => new Date(a.start) - new Date(b.start)
  );

  return events.map((ev) => ({
    ...ev,
    start: new Date(ev.start).toISOString(),
    end: new Date(ev.end).toISOString(),
  }));
}
