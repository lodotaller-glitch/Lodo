"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import { startOfWeek, format, parse, getDay } from "date-fns";
import es from "date-fns/locale/es";
import "react-big-calendar/lib/css/react-big-calendar.css";
import {
  fetchAllProfessorsMonthEvents,
  fetchProfessorMonthEvents,
} from "@/functions/request/schedule";

const BRAND = { main: "#A08775", soft: "#DDD7C9", text: "#1F1C19" };
const DOW = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const localizer = dateFnsLocalizer({
  format: (date, fmt, options) =>
    format(date, fmt, { locale: es, ...(options || {}) }),
  parse: (value, fmt) => parse(value, fmt, new Date(), { locale: es }),
  startOfWeek: (date) => startOfWeek(date, { weekStartsOn: 1, locale: es }),
  getDay,
  locales: { es },
});

function slotKeyWithProf(s, professorId) {
  return `${professorId}-${s.dayOfWeek}-${s.startMin}-${s.endMin}`;
}

function strMin(min) {
  const h = Math.floor(min / 60),
    m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export default function CalendarSlotSelector({
  professorId, // opcional; si viene lo usamos como preselección
  year,
  month,
  initialSlots = [],
  allowProfessorChange = false, // 👈 nuevo flag
  onChange,
}) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(() => initialSlots);
  const [monthDate, setMonthDate] = useState(
    () => new Date(Date.UTC(year, month - 1, 1))
  );
  const [selectedProfessor, setSelectedProfessor] = useState(
    professorId || null
  );

  const selectedKeys = useMemo(
    () =>
      new Set(selected.map((s) => slotKeyWithProf(s, selectedProfessor || ""))),
    [selected, selectedProfessor]
  );

  const fetchData = useCallback(async () => {
    if (!year || !month) return;
    setLoading(true);
    setError("");
    try {
      const { events } = await (allowProfessorChange
        ? fetchAllProfessorsMonthEvents({ year, month })
        : fetchProfessorMonthEvents({ professorId, year, month }));
      const mapped = (events || []).map((ev) => {
        const start = new Date(ev.start);
        const end = new Date(ev.end);

        const dayOfWeek = ev.dayOfWeek ?? ev.weekday ?? start.getUTCDay();
        const startMin =
          ev.startMin ?? start.getUTCHours() * 60 + start.getUTCMinutes();
        const endMin =
          ev.endMin ?? end.getUTCHours() * 60 + end.getUTCMinutes();
        const key =
          ev.slotKey ?? `${ev.professorId}-${dayOfWeek}-${startMin}-${endMin}`;

        return {
          title: ev.title,
          start,
          end,
          resource: {
            ...ev,
            dayOfWeek,
            startMin,
            endMin,
            slotKey: key,
            professorId: ev.professorId,
          },
          allDay: false,
        };
      });

      setEvents(mapped);
    } catch (e) {
      setError(e?.message || "No se pudo cargar");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [professorId, year, month]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const eventPropGetter = useCallback(
    (event) => {
      const r = event.resource;

      const k = event.slotKey ?? slotKeyWithProf(r, r.professorId);

      const isSelected = selectedKeys.has(k);
      const base = {
        borderRadius: 12,
        border: `1px solid ${BRAND.main}22`,
        borderLeft: `6px solid ${BRAND.main}`,
        backgroundColor: isSelected ? BRAND.main : "white",
        color: isSelected ? "#fff" : BRAND.text,
      };
      if (r.status === "full" && !isSelected) {
        base.backgroundColor = "#fce7e7";
        base.color = "#7f1d1d";
      }
      return { style: base };
    },
    [selectedKeys]
  );

  function parseSlotFromResource(r) {
    if (r.slotKey && r.professorId) {
      const parts = r.slotKey.split("-").map(String);
      // soporta formato con profId prefijado
      // ej: "689cbb...-1-720-840" → quitamos el primer segmento si coincide con el professorId
      const segs = parts[0] === String(r.professorId) ? parts.slice(1) : parts;
      const [dayOfWeek, startMin, endMin] = segs.map(Number);
      return { dayOfWeek, startMin, endMin };
    }
    // Fallback: derivar desde start/end (en UTC; usa getHours si tu backend guarda horario local)
    const start = new Date(r.start);
    const end = new Date(r.end);
    const dayOfWeek = r.weekday ?? start.getUTCDay();
    const startMin = start.getUTCHours() * 60 + start.getUTCMinutes();
    const endMin = end.getUTCHours() * 60 + end.getUTCMinutes();
    return { dayOfWeek, startMin, endMin };
  }

  // FIX: toggleSlot
  function toggleSlot(resource) {
    const s = parseSlotFromResource(resource);
    const profId = resource.professorId;
    // Si el profe cambia y ya había selección, reseteamos y empezamos con el nuevo profe
    console.log(
      profId,
      selectedProfessor,
      "profId and selectedProfessor in toggleSlot"
    );

    if (
      selectedProfessor &&
      selectedProfessor !== profId &&
      selected.length > 0
    ) {
      setSelectedProfessor(profId);
      setSelected([s]);
      onChange?.({ professorId: profId, slots: [s] });
      return;
    }
    // Si no había profe elegido aún, fìjalo
    if (!selectedProfessor) setSelectedProfessor(profId);

    const k = slotKeyWithProf(s, profId);

    const arr = [...selected];
    const i = arr.findIndex((x) => slotKeyWithProf(x, profId) === k);

    if (i >= 0) {
      arr.splice(i, 1);
    } else {
      if (arr.length >= 2) return;
      arr.push(s);
    }
    console.log(arr);

    setSelected(arr);
    onChange?.({ professorId: profId, slots: arr });
  }

  console.log(events, "events in CalendarSlotSelector");

  return (
    <section className="space-y-3">
      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          {error}
        </div>
      )}
      {loading && (
        <div className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-3">
          Cargando…
        </div>
      )}

      <div className="bg-white rounded-2xl shadow p-3">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: 640 }}
          views={["month", "week", "day"]}
          defaultView="month"
          messages={rbCalendarEsMessages}
          eventPropGetter={eventPropGetter}
          popup
          onNavigate={(newDate) => setMonthDate(new Date(newDate))}
          onSelectEvent={(ev) => {
            toggleSlot(ev.resource);
            return;
          }}
        />
      </div>

      <div className="text-sm">
        Seleccionados:{" "}
        {selected.map(
          (s, i) =>
            `${i ? ", " : ""}${DOW[s.dayOfWeek]} ${strMin(s.startMin)}–${strMin(
              s.endMin
            )}`
        )}
      </div>
    </section>
  );
}

const rbCalendarEsMessages = {
  date: "Fecha",
  time: "Hora",
  event: "Evento",
  allDay: "Todo el día",
  week: "Semana",
  work_week: "Semana laboral",
  day: "Día",
  month: "Mes",
  previous: "Anterior",
  next: "Siguiente",
  yesterday: "Ayer",
  tomorrow: "Mañana",
  today: "Hoy",
  agenda: "Agenda",
  noEventsInRange: "No hay eventos en este rango",
  showMore: (t) => `+ Ver más (${t})`,
};
