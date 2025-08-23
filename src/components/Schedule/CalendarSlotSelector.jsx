"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import { startOfWeek, format, parse, getDay } from "date-fns";
import es from "date-fns/locale/es";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { fetchAllProfessorsMonthEvents } from "@/functions/request/schedule";

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
  const h = String(Math.floor(min / 60)).padStart(2, "0");
  const m = String(min % 60).padStart(2, "0");
  return `${h}:${m}`;
}

export default function CalendarSlotSelector({
  professorId, // opcional; si viene lo usamos como preselección
  year,
  month,
  initialSlots = [],
  allowProfessorChange = false,
  dateWindow = null, // {start, end} opcional para modo "single"
  maxSlots = 2,
  onChange,
}) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(() => initialSlots ?? []);
  const [monthDate, setMonthDate] = useState(
    () => new Date(Date.UTC(year, month - 1, 1))
  );
  const [selectedProfessor, setSelectedProfessor] = useState(
    professorId || null
  );

  // Mantener sincronizado selectedProfessor cuando cambia prop
  useEffect(() => {
    if (professorId) setSelectedProfessor(professorId);
  }, [professorId]);

  useEffect(() => {
    if (maxSlots === 1) return; // no pisar selección en single
    setSelected(initialSlots || []);
  }, [initialSlots, maxSlots]);

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
      const data = await fetchAllProfessorsMonthEvents({ year, month });

      const mapped = (data?.events || [])
        .map((ev) => {
          const pid =
            ev.professorId ||
            ev.professor ||
            ev.profesor ||
            ev.prof ||
            (ev.slotKey ? String(ev.slotKey).split("-")[0] : undefined);

          const start = new Date(ev.start);
          const end = new Date(ev.end);
          const dayOfWeek = ev.dayOfWeek ?? ev.weekday ?? start.getUTCDay();
          const startMin =
            ev.startMin ?? start.getUTCHours() * 60 + start.getUTCMinutes();
          const endMin =
            ev.endMin ?? end.getUTCHours() * 60 + end.getUTCMinutes();
          const key =
            ev.slotKey || slotKeyWithProf({ dayOfWeek, startMin, endMin }, pid);

          // Filtrar por ventana si corresponde (modo single)
          if (dateWindow) {
            if (start < dateWindow.start || end > dateWindow.end) return null;
          }

          return {
            title:
              ev.title ||
              `${ev.professorName ? ev.professorName + " • " : ""}${
                DOW[dayOfWeek]
              } ${strMin(startMin)}–${strMin(endMin)}${
                typeof ev.capacityLeft === "number"
                  ? ` • ${ev.capacityLeft} disp.`
                  : ""
              }`,
            start,
            end,
            slotKey: key,
            resource: {
              ...ev,
              dayOfWeek,
              startMin,
              endMin,
              slotKey: key,
              professorId: pid,
            },
            allDay: false,
          };
        })
        .filter(Boolean);

      setEvents(mapped);
    } catch (e) {
      setError(e?.message || "No se pudo cargar");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [allowProfessorChange, professorId, year, month, dateWindow]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const eventPropGetter = useCallback(
    (event) => {
      const r = event.resource;
      const k = event.slotKey ?? slotKeyWithProf(r, r.professorId);
      const isSelected = selectedKeys.has(k);
      const disabled = r.status === "full" || r.capacityLeft === 0;

      const base = {
        backgroundColor: isSelected ? BRAND.main : BRAND.soft,
        color: isSelected ? "white" : BRAND.text,
        border: isSelected ? `2px solid ${BRAND.main}` : "1px solid #ddd",
        borderRadius: "10px",
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      };
      if (disabled && !isSelected) {
        base.backgroundColor = "#fce7e7";
        base.color = "#7f1d1d";
      }
      return { style: base };
    },
    [selectedKeys]
  );

  function parseSlotFromResource(r) {
    if (r.slotKey) {
      const parts = String(r.slotKey).split("-");
      const segs = parts[0] === String(r.professorId) ? parts.slice(1) : parts;
      const [dayOfWeek, startMin, endMin] = segs.map(Number);
      return { dayOfWeek, startMin, endMin };
    }
    const start = new Date(r.start);
    const end = new Date(r.end);
    const dayOfWeek = r.weekday ?? start.getUTCDay();
    const startMin = start.getUTCHours() * 60 + start.getUTCMinutes();
    const endMin = end.getUTCHours() * 60 + end.getUTCMinutes();
    return { dayOfWeek, startMin, endMin };
  }

  function toggleSlot(resource) {
    const s = parseSlotFromResource(resource);
    const profId = resource.professorId;

    // Si cambia de profesor con selección previa, reemplazar
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
    if (!selectedProfessor) setSelectedProfessor(profId);

    const k = slotKeyWithProf(s, profId);
    const arr = [...selected];
    const idx = arr.findIndex((x) => slotKeyWithProf(x, profId) === k);

    if (idx >= 0) {
      arr.splice(idx, 1);
    } else {
      if (arr.length >= (maxSlots || 2)) return;
      arr.push(s);
    }

    setSelected(arr);
    onChange?.({ professorId: profId, slots: arr });
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg p-3">
          {error}
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
            const r = ev.resource;
            if (r.status === "full" || r.capacityLeft === 0) return;
            toggleSlot(r);
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
    </div>
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
