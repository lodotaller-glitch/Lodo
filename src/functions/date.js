// deps:
// npm i date-fns date-fns-tz
import { parseISO, addHours } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { es } from "date-fns/locale";

/**
 * Suma 3 horas a `input` y lo formatea en la zona horaria dada (default: Córdoba, AR).
 * @param {Date|string|number} input - Date, ISO string o timestamp.
 * @param {Object} opts
 * @param {string} [opts.tz="America/Argentina/Cordoba"] - Zona IANA.
 * @param {string} [opts.pattern="dd/MM/yyyy HH:mm"] - Patrón de salida.
 * @param {Locale} [opts.locale=es] - Locale de date-fns.
 * @returns {string} fecha formateada
 */
export function formatPlus3hAR(input, opts = {}) {
  const {
    tz = "America/Argentina/Cordoba",
    pattern = "dd/MM/yyyy HH:mm",
    locale = es,
  } = opts;

  let d;
  if (input instanceof Date) d = input;
  else if (typeof input === "string") d = parseISO(input);
  else d = new Date(input);

  if (Number.isNaN(d.getTime())) throw new Error("Fecha inválida");

  const plus3 = addHours(d, 3); // suma 3h al instante
  return formatInTimeZone(plus3, tz, pattern, { locale });
}

const DOW = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
export function formatSlotPlusHours(slot, hours = 2) {
  if (!slot) return "";
  const add = hours * 60;
  const total = (slot.startMin ?? 0) + add;
  const dayShift = Math.floor(total / 1440);
  const newMin = ((total % 1440) + 1440) % 1440;
  const newDOW = ((slot.dayOfWeek ?? 0) + dayShift) % 7;
  const hh = String(Math.floor(newMin / 60)).padStart(2, "0");
  const mm = String(newMin % 60).padStart(2, "0");
  return `${hh}:${mm} ${DOW[newDOW]}`;
}
