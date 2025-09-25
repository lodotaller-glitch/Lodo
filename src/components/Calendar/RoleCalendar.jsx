// components/calendar/RoleCalendar.jsx
"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Calendar,
  dateFnsLocalizer,
  Views,
  Navigate,
} from "react-big-calendar";

import {
  startOfWeek,
  format,
  parse,
  getDay,
  addMonths,
  subMonths,
  addHours,
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
  const [view, setView] = useState(Views.MONTH);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

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
        start: addHours(new Date(ev.start), 3), // +3 hs para visualizar
        end: addHours(new Date(ev.end), 3), // +3 hs para visualizar
        resource: ev, // queda “crudo” para tus rutas
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
  const eventPropGetter = useCallback(
    (event) => {
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
    },
    [role]
  );

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
          view={view} // <-- pasa vista actual
          onView={(v) => setView(v)} // <-- y el setter
          monthDate={monthDate}
          setMonthDate={(d) => {
            setMonthDate(d);
            onMonthChange?.(d);
          }}
        />
      ),
    }),
    [view, monthDate, onMonthChange]
  );

  return (
    <section className="space-y-4">
      {/* Filtros / Header */}
      {showFilters && (
        <div
          className="rounded-2xl border p-4 sm:p-5 shadow-sm space-y-4 md:space-y-0 md:flex md:items-end md:justify-between"
          style={{
            borderColor: BRAND.soft,
            background: `linear-gradient(180deg, ${BRAND.soft}55, #ffffff)`,
          }}
        >
          {/* Chips de profesores (scroll en mobile, wrap en desktop) */}
          <div className="-mx-2 -mt-1 md:m-0 px-2 overflow-x-auto md:overflow-visible">
            <div className="flex min-w-max gap-2 md:min-w-0 md:flex-wrap">
              {role === "admin" &&
                uniqueProfessors.map((p) => {
                  const active = selectedProfIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => toggleSelected(p.id)}
                      className={`group flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm whitespace-nowrap transition
                            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
                            ${active ? "shadow-sm" : "hover:shadow-sm"}`}
                      style={{
                        borderColor: active ? BRAND.main : BRAND.soft,
                        background: active ? "#fff" : "#ffffffb3", // blanco 70%
                        color: BRAND.text,
                      }}
                      title={p.name}
                    >
                      <span
                        className="inline-block w-3 h-3 rounded shrink-0"
                        style={{ background: colorForProfessor(p.id) }}
                      />
                      <span className="truncate max-w-[160px]">{p.name}</span>
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Controles (grid en mobile, alineado en desktop) */}
          <div className="grid w-full md:w-auto grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:items-end">
            {(role === "admin" || role === "professor") && (
              <label
                className="inline-flex items-center justify-between sm:justify-start gap-3 rounded-xl border px-3 py-2 text-sm"
                style={{
                  borderColor: BRAND.soft,
                  background: "#fff",
                  color: BRAND.text,
                }}
              >
                <input
                  type="checkbox"
                  checked={hideFull}
                  onChange={(e) => setHideFull(e.target.checked)}
                  className="shrink-0"
                  style={{ accentColor: BRAND.main }}
                />
                <span className="truncate">Ocultar completas</span>
              </label>
            )}

            <label className="flex flex-col">
              <span
                className="text-sm mb-1"
                style={{ color: `${BRAND.text}CC` }}
              >
                Mes
              </span>
              <input
                type="month"
                className="rounded-xl border bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition focus:ring-2"
                style={{ borderColor: BRAND.soft, color: BRAND.text }}
                value={ymToMonthInputValue(monthDate)}
                onChange={(e) =>
                  setMonthDate(monthInputValueToDate(e.target.value))
                }
              />
            </label>

            <button
              onClick={fetchEvents}
              className="rounded-xl px-4 py-2.5 font-semibold text-white shadow-sm hover:brightness-95 active:translate-y-[1px] transition sm:w-auto w-full md:justify-self-end"
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

      <div
        className={
          isMobile && view === Views.WEEK
            ? "overflow-x-auto -mx-3 sm:mx-0 px-3"
            : ""
        }
        style={
          isMobile && view === Views.WEEK
            ? { WebkitOverflowScrolling: "touch" } // scroll suave en iOS
            : undefined
        }
      >
        {/* Este inner fuerza un ancho mínimo “grande” para que aparezca la barra */}
        <div
          style={
            isMobile && view === Views.WEEK
              ? { minWidth: 1200 } // probá 1200–1400px según tus eventos
              : undefined
          }
        >
          <Calendar
            localizer={localizer}
            events={filteredEvents}
            startAccessor="start"
            endAccessor="end"
            date={monthDate}
            view={view}
            onView={(v) => setView(v)}
            style={{
              height: 720,
              background: "white",
              borderRadius: 16,
              padding: 12,
            }}
            views={[Views.MONTH, Views.WEEK, Views.DAY]}
            defaultView={Views.MONTH}
            eventPropGetter={eventPropGetter}
            messages={rbCalendarEsMessages}
            components={components}
            showAllEvents={isMobile && view === Views.MONTH}
            popup={!(isMobile && view === Views.MONTH)}
            onNavigate={(newDate) => setMonthDate(new Date(newDate))}
            onSelectEvent={handleEventClick}
            // Opcional: empezar la vista semana scrolleada cerca de las 9
            scrollToTime={new Date(1970, 0, 1, 9, 0, 0)}
          />
        </div>
      </div>

      <Legend role={role === "student"} />
    </section>
  );
}

// function CustomToolbar({
//   label,
//   onNavigate,
//   onView,
//   view,
//   monthDate,
//   setMonthDate,
// }) {
//   return (
//     <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
//       <div className="flex items-center gap-2">
//         <button
//           onClick={() => {
//             setMonthDate((d) => subMonths(d, 1));
//             onNavigate("PREV");
//           }}
//           className="px-3 py-1.5 rounded-lg border"
//         >
//           ◀ Mes anterior
//         </button>
//         <button
//           onClick={() => {
//             const now = new Date();
//             setMonthDate(new Date(now.getFullYear(), now.getMonth(), 1));
//             onNavigate("TODAY");
//           }}
//           className="px-3 py-1.5 rounded-lg border"
//         >
//           Hoy
//         </button>
//         <button
//           onClick={() => {
//             setMonthDate((d) => addMonths(d, 1));
//             onNavigate("NEXT");
//           }}
//           className="px-3 py-1.5 rounded-lg border"
//         >
//           Mes siguiente ▶
//         </button>
//       </div>
//       <div className="text-base font-medium">
//         {format(monthDate, "MMMM yyyy", { locale: es })}
//       </div>
//       <div className="flex items-center gap-2">
//         <button
//           onClick={() => onView("month")}
//           className={`px-3 py-1.5 rounded-lg border ${
//             view === "month" ? "bg-white" : ""
//           }`}
//         >
//           Mes
//         </button>
//         <button
//           onClick={() => onView("week")}
//           className={`px-3 py-1.5 rounded-lg border ${
//             view === "week" ? "bg-white" : ""
//           }`}
//         >
//           Semana
//         </button>
//         <button
//           onClick={() => onView("day")}
//           className={`px-3 py-1.5 rounded-lg border ${
//             view === "day" ? "bg-white" : ""
//           }`}
//         >
//           Día
//         </button>
//       </div>
//     </div>
//   );
// }

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
            onNavigate(Navigate.PREVIOUS);
          }}
          className="px-3 py-1.5 rounded-lg border"
        >
          ◀ Mes anterior
        </button>
        <button
          onClick={() => {
            const now = new Date();
            setMonthDate(new Date(now.getFullYear(), now.getMonth(), 1));
            onNavigate(Navigate.TODAY);
          }}
          className="px-3 py-1.5 rounded-lg border"
        >
          Hoy
        </button>
        <button
          onClick={() => {
            setMonthDate((d) => addMonths(d, 1));
            onNavigate(Navigate.NEXT);
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
          onClick={() => onView(Views.MONTH)}
          className={`px-3 py-1.5 rounded-lg border ${
            view === Views.MONTH ? "bg-white" : ""
          }`}
        >
          Mes
        </button>
        <button
          onClick={() => onView(Views.WEEK)}
          className={`px-3 py-1.5 rounded-lg border ${
            view === Views.WEEK ? "bg-white" : ""
          }`}
        >
          Semana
        </button>
        <button
          onClick={() => onView(Views.DAY)}
          className={`px-3 py-1.5 rounded-lg border ${
            view === Views.DAY ? "bg-white" : ""
          }`}
        >
          Día
        </button>
      </div>
    </div>
  );
}

function Legend({ role }) {
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
