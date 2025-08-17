"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import {
  startOfWeek,
  format,
  parse,
  getDay,
  addMonths,
  subMonths,
} from "date-fns";
import es from "date-fns/locale/es";
import "react-big-calendar/lib/css/react-big-calendar.css";

const locales = { es };
const localizer = dateFnsLocalizer({
  format: (date, fmt, options) =>
    format(date, fmt, { locale: es, ...(options || {}) }),
  parse: (value, fmt) => parse(value, fmt, new Date(), { locale: es }),
  startOfWeek: (date) => startOfWeek(date, { weekStartsOn: 1, locale: es }),
  getDay,
  locales,
});

function ymToMonthInputValue(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
function monthInputValueToDate(value) {
  if (!/^\d{4}-\d{2}$/.test(value)) return new Date();
  const [y, m] = value.split("-").map(Number);
  return new Date(y, m - 1, 1, 12, 0, 0, 0);
}

export default function AllProfessorsCalendarPage() {
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [selectedProfIds, setSelectedProfIds] = useState([]); // filtro múltiple
  const [hideFull, setHideFull] = useState(false);

  const year = monthDate.getFullYear();
  const month = monthDate.getMonth() + 1;

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const url = new URL(`/api/calendar`, window.location.origin);
      url.searchParams.set("year", String(year));
      url.searchParams.set("month", String(month));
      if (selectedProfIds.length) {
        url.searchParams.set("professorIds", selectedProfIds.join(","));
      }
      const res = await fetch(url.toString());
      const data = await res.json();
      console.log(data);

      if (!res.ok) throw new Error(data?.error || "No se pudo cargar");

      const mapped = (data.events || []).map((ev) => ({
        title: ev.title,
        start: new Date(ev.start),
        end: new Date(ev.end),
        resource: ev,
        allDay: false,
      }));
      setEvents(mapped);
    } catch (err) {
      setError(err.message || "Error desconocido");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [year, month, selectedProfIds]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const uniqueProfessors = useMemo(() => {
    const map = new Map();
    console.log(events);
    
    for (const e of events) {
      const id = e.resource.professorId;
      const name = e.resource.professorNombre || "Professor";
      map.set(id, name);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [events]);

  function toggleSelected(id) {
    setSelectedProfIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  // Color estable por professor (borde izquierdo)
  function colorForProfessor(id) {
    // hash simple -> hue 0..360
    let hash = 0;
    for (let i = 0; i < id.length; i++)
      hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
    const hue = hash % 360;
    return `hsl(${hue} 70% 40%)`;
  }

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      const profOk =
        !selectedProfIds.length ||
        selectedProfIds.includes(e.resource.professorId);
      const fullOk = !hideFull || e.resource.status !== "full";
      return profOk && fullOk;
    });
  }, [events, selectedProfIds, hideFull]);

  const eventPropGetter = useCallback((event) => {
    const status = event?.resource?.status;
    const profId = event?.resource?.professorId;
    const borderColor = colorForProfessor(profId);
    const style = {
      borderRadius: "12px",
      border: "1px solid rgba(0,0,0,0.08)",
      borderLeft: `6px solid ${borderColor}`,
    };
    if (status === "full") {
      style.backgroundColor = "#fee2e2"; // rojo claro
      style.color = "#991b1b";
    } else {
      style.backgroundColor = "#dcfce7"; // verde claro
      style.color = "#14532d";
    }
    return { style };
  }, []);

  const components = useMemo(
    () => ({
      toolbar: (props) => (
        <CustomToolbar
          {...props}
          monthDate={monthDate}
          setMonthDate={setMonthDate}
        />
      ),
    }),
    [monthDate]
  );
  console.log(uniqueProfessors);
  

  return (
    <main className="max-w-7xl mx-auto p-6 space-y-6">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">
            Calendario de TODOS los professores
          </h1>
          <p className="text-sm text-gray-600">
            Mostrando las franjas semanales de todos los profes en el mes
            seleccionado. Usá los filtros para acotar.
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-3">
          <label className="flex flex-col">
            <span className="text-sm text-gray-600 mb-1">Mes</span>
            <input
              type="month"
              className="border rounded-lg px-3 py-2"
              value={ymToMonthInputValue(monthDate)}
              onChange={(e) =>
                setMonthDate(monthInputValueToDate(e.target.value))
              }
            />
          </label>
          <button
            onClick={fetchEvents}
            className="px-4 py-2 rounded-xl bg-black text-white hover:opacity-90"
          >
            Actualizar
          </button>
        </div>
      </header>

      <section className="bg-white rounded-2xl shadow p-4 space-y-4">
        <div className="flex flex-col md:flex-row gap-4 md:items-end md:justify-between">
          <div className="flex flex-wrap gap-2">
            {uniqueProfessors.map((p) => (
              <button
                key={p.id}
                onClick={() => toggleSelected(p.id)}
                className={`px-3 py-1.5 rounded-lg border flex items-center gap-2 ${
                  selectedProfIds.includes(p.id) ? "bg-gray-100" : "bg-white"
                }`}
                title={p.professorName}
              >
                <span
                  className="inline-block w-3 h-3 rounded"
                  style={{
                    background: `hsl(${
                      p.id
                        .split("")
                        .reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 0) %
                      360
                    } 70% 40%)`,
                  }}
                />
                <span className="truncate max-w-[140px]">{p.name}</span>
              </button>
            ))}
          </div>

          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={hideFull}
              onChange={(e) => setHideFull(e.target.checked)}
            />
            Ocultar completas
          </label>
        </div>

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

        <Calendar
          localizer={localizer}
          events={filteredEvents}
          startAccessor="start"
          endAccessor="end"
          style={{ height: 720 }}
          views={["month", "week", "day"]}
          defaultView="month"
          eventPropGetter={eventPropGetter}
          messages={rbCalendarEsMessages}
          components={components}
          popup
          onNavigate={(newDate) => setMonthDate(new Date(newDate))}
          onSelectEvent={(e) => {
            const r = e.resource;
            alert(
              `${r.professorNombre}\n${new Date(
                r.start
              ).toLocaleString()} – ${new Date(
                r.end
              ).toLocaleString()}\nCupos: ${r.capacityLeft} (${r.status})`
            );
          }}
        />
      </section>

      <Legend />
    </main>
  );
}

function CustomToolbar({
  label,
  onNavigate,
  onView,
  view,
  monthDate,
  setMonthDate,
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            setMonthDate((d) => subMonths(d, 1));
            onNavigate("PREV");
          }}
          className="px-3 py-1.5 rounded-lg border"
        >
          ◀ Mes anterior
        </button>
        <button
          onClick={() => {
            const now = new Date();
            setMonthDate(new Date(now.getFullYear(), now.getMonth(), 1));
            onNavigate("TODAY");
          }}
          className="px-3 py-1.5 rounded-lg border"
        >
          Hoy
        </button>
        <button
          onClick={() => {
            setMonthDate((d) => addMonths(d, 1));
            onNavigate("NEXT");
          }}
          className="px-3 py-1.5 rounded-lg border"
        >
          Mes siguiente ▶
        </button>
      </div>
      <div className="text-base font-medium">
        {format(monthDate, "MMMM yyyy", { locale: es })}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onView("month")}
          className={`px-3 py-1.5 rounded-lg border ${
            view === "month" ? "bg-gray-100" : ""
          }`}
        >
          Mes
        </button>
        <button
          onClick={() => onView("week")}
          className={`px-3 py-1.5 rounded-lg border ${
            view === "week" ? "bg-gray-100" : ""
          }`}
        >
          Semana
        </button>
        <button
          onClick={() => onView("day")}
          className={`px-3 py-1.5 rounded-lg border ${
            view === "day" ? "bg-gray-100" : ""
          }`}
        >
          Día
        </button>
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-4 text-sm">
      <span className="inline-flex items-center gap-2">
        <i
          className="w-4 h-4 rounded"
          style={{
            background: "#dcfce7",
            border: "1px solid rgba(0,0,0,0.08)",
          }}
        />{" "}
        Disponible
      </span>
      <span className="inline-flex items-center gap-2">
        <i
          className="w-4 h-4 rounded"
          style={{
            background: "#fee2e2",
            border: "1px solid rgba(0,0,0,0.08)",
          }}
        />{" "}
        Completo
      </span>
      <span className="text-gray-500">Color de borde = professor</span>
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
  showMore: (total) => `+ Ver más (${total})`,
};
