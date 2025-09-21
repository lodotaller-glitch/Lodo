// components/calendar/RoleCalendar.jsx
"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
import { useAuth } from "@/context/AuthContext";

// Paleta
const BRAND = {
  main: "#A08775",
  soft: "#DDD7C9",
  text: "#1F1C19",
  full: "#CD5C5C",
  noFull: "#90EE90",
};

// Localizer en español
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

// Mensajes de RbCalendar en ES
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

export default function RoleCalendar({
  role: roleProp,
  monthDate: monthDateProp,
  onMonthChange,
  professorId: professorIdProp,
  studentId: studentIdProp,
  fetchUrlOverride,
  onEventClick,
  showFilters: showFiltersProp,
  extraParams,
}) {
  const router = useRouter();
  const { user } = useAuth();
  const { branchId } = useParams();

  const role = roleProp || user?.role || null;
  const professorId =
    professorIdProp || (role === "professor" ? user?._id : undefined);
  const studentId =
    studentIdProp || (role === "student" ? user?._id : undefined);

  const [monthDate, setMonthDate] = useState(monthDateProp || new Date());
  useEffect(() => {
    if (monthDateProp) setMonthDate(monthDateProp);
  }, [monthDateProp]);

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hideFull, setHideFull] = useState(false);
  const [selectedProfIds, setSelectedProfIds] = useState([]); // para admin

  const year = monthDate.getFullYear();
  const month = monthDate.getMonth() + 1;

  const showFilters = useMemo(() => {
    if (typeof showFiltersProp === "boolean") return showFiltersProp;
    return role === "admin" || role === "professor"; // student no muestra filtros
  }, [role, showFiltersProp]);

  const buildUrl = useCallback(() => {
    if (fetchUrlOverride) return fetchUrlOverride;
    switch (role) {
      case "admin":
        return `/api/${branchId}/calendar`; // year, month, professorIds?
      case "networks":
        return `/api/${branchId}/calendar`; // year, month, professorIds?
      case "professor":
        return "/api/calendar/professor"; // year, month, professorId
      case "student":
      default:
        return "/api/calendar/student"; // year, month, studentId
    }
  }, [role, fetchUrlOverride]);

  const fetchEvents = useCallback(async () => {
    if (!user) return null;
    if (!role) return null;
    setLoading(true);
    setError("");
    try {
      const url = new URL(buildUrl(), window.location.origin);
      url.searchParams.set("year", String(year));
      url.searchParams.set("month", String(month));
      if (role === "professor") {
        url.searchParams.set("professorId", String(professorId || ""));
      } else if (role === "student") {
        url.searchParams.set("studentId", String(studentId || ""));
      } else if (role === "admin") {
        if (selectedProfIds.length)
          url.searchParams.set("professorId", selectedProfIds.join(","));
      }
      if (extraParams) {
        for (const [k, v] of Object.entries(extraParams))
          url.searchParams.set(k, String(v));
      }

      const res = await fetch(url.toString());
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No se pudo cargar");

      const mapped = (data.events || []).map((ev) => ({
        title: ev.title,
        start: new Date(ev.start),
        end: new Date(ev.end),
        resource: ev,
        classStatus: ev?.classState || false,
        allDay: false,
      }));
      setEvents(mapped);
    } catch (err) {
      setError(err.message || "Error desconocido");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [
    buildUrl,
    year,
    month,
    role,
    professorId,
    studentId,
    selectedProfIds,
    extraParams,
    user,
  ]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Profes para chips (solo admin)
  const uniqueProfessors = useMemo(() => {
    if (role !== "admin") return [];
    const map = new Map();
    for (const e of events) {
      const id = e.resource.professorId;
      const name = e.resource.professorName || "Profesor";
      map.set(id, name);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [events, role]);

  function toggleSelected(id) {
    setSelectedProfIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  // Color estable por profesor
  function colorForProfessor(id = "") {
    let hash = 0;
    for (let i = 0; i < id.length; i++)
      hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
    const hue = hash % 360;
    return `hsl(${hue} 60% 35%)`;
  }

  // Filtros visuales
  const filteredEvents = useMemo(() => {
    const base =
      role === "admin" && selectedProfIds.length
        ? events.filter((e) => selectedProfIds.includes(e.resource.professorId))
        : events;
    return hideFull ? base.filter((e) => e.resource.status !== "full") : base;
  }, [events, role, selectedProfIds, hideFull]);

  // Estilo por evento con paleta de marca
  const eventPropGetter = useCallback((event) => {
    const status = event?.resource?.status;
    const profId = event?.resource?.professorId;
    const classState = event?.resource?.classState;

    const style = {
      borderRadius: 12,
      border: `1px solid ${BRAND.main}22`,
      borderLeft: `6px solid ${colorForProfessor(profId)}`,
      backgroundColor:
        role !== "student"
          ? status === "full"
            ? BRAND.full
            : BRAND.noFull
          : classState
          ? BRAND.noFull
          : BRAND.full,
      color:
        role !== "student"
          ? status === "full"
            ? "#fff"
            : BRAND.text
          : classState
          ? BRAND.text
          : "#fff",
    };
    return { style };
  }, []);

  // Navegación por defecto según rol
  const handleEventClick = useCallback(
    (ev) => {
      const r = ev.resource;
      if (onEventClick) return onEventClick(ev);
      const startISO = new Date(r.start).toISOString();
      if (role === "admin" || role === "networks") {
        router.push(
          `/${branchId}/calendar/class?enrollmentId=${
            r._id
          }&start=${encodeURIComponent(startISO)}&slot=${encodeURIComponent(
            r.slotKey || ""
          )}`
        );
      } else if (role === "professor") {
        router.push(
          `/professor/class?start=${encodeURIComponent(
            startISO
          )}&slot=${encodeURIComponent(r.slotKey || "")}`
        );
      } else {
        // student
        router.push(
          `/student/my-class?start=${encodeURIComponent(
            startISO
          )}&professorId=${r.professorId}`
        );
      }
    },
    [router, role, onEventClick]
  );

  const components = useMemo(
    () => ({
      toolbar: (props) => (
        <CustomToolbar
          {...props}
          monthDate={monthDate}
          setMonthDate={(d) => {
            setMonthDate(d);
            onMonthChange?.(d);
          }}
        />
      ),
    }),
    [monthDate, onMonthChange]
  );

  return (
    <section className="space-y-4">
      {/* Filtros / Header */}
      {showFilters && (
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            {role === "admin" &&
              uniqueProfessors.map((p) => (
                <button
                  key={p.id}
                  onClick={() => toggleSelected(p.id)}
                  className={`px-3 py-1.5 rounded-lg border flex items-center gap-2 ${
                    selectedProfIds.includes(p.id) ? "bg-white" : "bg-white/70"
                  }`}
                  title={p.name}
                >
                  <span
                    className="inline-block w-3 h-3 rounded"
                    style={{ background: colorForProfessor(p.id) }}
                  />
                  <span className="truncate max-w-[140px]">{p.name}</span>
                </button>
              ))}
          </div>

          <div className="flex items-center gap-4">
            {(role === "admin" || role === "professor") && (
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={hideFull}
                  onChange={(e) => setHideFull(e.target.checked)}
                />
                Ocultar completas
              </label>
            )}

            <label className="flex flex-col">
              <span className="text-sm" style={{ color: BRAND.text }}>
                Mes
              </span>
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
              className="px-4 py-2 rounded-xl text-white hover:opacity-90"
              style={{ background: BRAND.main }}
            >
              Actualizar
            </button>
          </div>
        </div>
      )}

      {error && (
        <div
          className="text-sm"
          style={{
            color: "#7f1d1d",
            background: "#fee2e2",
            border: "1px solid #fecaca",
            borderRadius: 8,
            padding: 12,
          }}
        >
          {error}
        </div>
      )}
      {loading && (
        <div
          className="text-sm"
          style={{
            background: "#f3f4f6",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            padding: 12,
          }}
        >
          Cargando…
        </div>
      )}

      <Calendar
        localizer={localizer}
        events={filteredEvents}
        startAccessor="start"
        endAccessor="end"
        date={monthDate}
        style={{
          height: 720,
          background: "white",
          borderRadius: 16,
          padding: 12,
        }}
        views={["month", "week", "day"]}
        defaultView="month"
        eventPropGetter={eventPropGetter}
        messages={rbCalendarEsMessages}
        components={components}
        popup
        onNavigate={(newDate) => setMonthDate(new Date(newDate))}
        onSelectEvent={handleEventClick}
      />

      <Legend role={role === "student"} />
    </section>
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
            view === "month" ? "bg-white" : ""
          }`}
        >
          Mes
        </button>
        <button
          onClick={() => onView("week")}
          className={`px-3 py-1.5 rounded-lg border ${
            view === "week" ? "bg-white" : ""
          }`}
        >
          Semana
        </button>
        <button
          onClick={() => onView("day")}
          className={`px-3 py-1.5 rounded-lg border ${
            view === "day" ? "bg-white" : ""
          }`}
        >
          Día
        </button>
      </div>
    </div>
  );
}

function Legend({role}) {
  return (
    <div className="flex items-center gap-4 text-sm">
      <span className="inline-flex items-center gap-2">
        <i
          className="w-4 h-4 rounded"
          style={{
            background: BRAND.noFull,
            border: `1px solid ${BRAND.main}22`,
          }}
        />{" "}
        {!role ? "Disponible" : "asistio"}
      </span>
      <span className="inline-flex items-center gap-2">
        <i
          className="w-4 h-4 rounded"
          style={{ background: BRAND.full, border: `1px solid ${BRAND.main}` }}
        />{" "}
        {!role ? "Completo" : "No asistio"}
      </span>
      <span className="text-gray-500">Color de borde = profesor</span>
    </div>
  );
}
