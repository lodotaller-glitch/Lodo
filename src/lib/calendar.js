// lib/calendar.js
import { ProfessorSchedule, Enrollment, User } from "@/models";
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
  const capacity = prof?.capacity ?? 10;

  // 3) inscripciones activas de ese mes para ese profe
  const enrollments = await Enrollment.find({
    professor: professorId,
    year,
    month,
    state: "activa",
    assigned: true,
  }).lean();

  // 4) conteo por franja elegida
  const countBySlot = new Map();
  for (const e of enrollments) {
    for (const s of e.chosenSlots) {
      const k = slotKey(s, professorId);
      countBySlot.set(k, (countBySlot.get(k) || 0) + 1);
    }
  }

  // 5) expandir a fechas del mes
  const events = [];
  for (const s of schedule.slots) {
    const k = slotKey(s, professorId);
    const taken = countBySlot.get(k) || 0;
    const left = Math.max(0, capacity - taken);

    const dates = datesForWeekdayInMonth(year, month, s.dayOfWeek);
    for (const day of dates) {
      const start = buildDateTimeUTC(day, s.startMin);
      const end = buildDateTimeUTC(day, s.endMin);
      if (end < monthStart || start > monthEnd) continue;

      events.push({
        title: `Clase (${taken}/${capacity})`,
        start,
        end,
        slotKey: k,
        weekday: s.dayOfWeek,
        status: left > 0 ? "available" : "full",
        capacityLeft: left,
      });
    }
  }

  // (Opcional) aplicá excepciones del professor acá (ver modelo más abajo)
  return events.sort((a, b) => a.start - b.start);
}

/**
 * Vista ESTUDIANTE: sus clases fijas del mes + pago.
 * Devuelve [{start,end,title,payment,professorId,slotKey}]
 */
export async function getStudentMonthCalendar({ studentId, year, month }) {
  await dbConnect();

  const enrollment = await Enrollment.findOne({
    student: studentId,
    year,
    month,
    state: "activa",
  })
    .populate("professor", "name")
    .lean();

  if (!enrollment) return [];

  const events = [];
  for (const s of enrollment.chosenSlots) {
    const dates = datesForWeekdayInMonth(year, month, s.dayOfWeek);
    for (const day of dates) {
      events.push({
        title: `Clase con ${enrollment.professor?.nombre || "Professor"}`,
        start: buildDateTimeUTC(day, s.startMin),
        end: buildDateTimeUTC(day, s.endMin),
        professorId: enrollment.professor?._id?.toString(),
        slotKey: slotKey(s, enrollment.professor?._id?.toString()),
        payment: enrollment.pago, // {estado, metodo, ...}
      });
    }
  }
  return events.sort((a, b) => a.start - b.start);
}
