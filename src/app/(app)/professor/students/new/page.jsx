"use client";
import { use, useCallback, useEffect, useMemo, useState } from "react";

const WEEKDAYS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

function ymToMonthInputValue(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
function monthInputValueToParts(value) {
  const [y, m] = value.split("-").map(Number);
  return { y, m };
}

export default function NewStudentAndReschedulePage({ params }) {
  // -------------- A) Crear + Inscribir --------------
  const [professors, setProfessors] = useState([]);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    professorId: "",
    monthStr: ymToMonthInputValue(new Date()),
  });
  const [slots, setSlots] = useState([]); // slots únicos del profe (por slotKey)
  const [chosenSlotKey, setChosenSlotKey] = useState("");
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [resultIns, setResultIns] = useState(null);
  const [errorIns, setErrorIns] = useState("");

  const { branchId } = use(params);

  useEffect(() => {
    fetch(`/api/${branchId}/professors`)
      .then((r) => r.json())
      .then((d) => setProfessors(d.professors || []));
  }, []);

  // cargar slots del profe/mes
  const reloadSlots = useCallback(async () => {
    setLoadingSlots(true);
    setErrorIns("");
    setSlots([]);
    try {
      const { y, m } = monthInputValueToParts(form.monthStr);
      if (!form.professorId) return;
      const url = new URL(`/api/calendar/professor`, window.location.origin);
      url.searchParams.set("professorId", form.professorId);
      url.searchParams.set("year", String(y));
      url.searchParams.set("month", String(m));
      const res = await fetch(url.toString());
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No se pudo cargar");
      // agrupar por slotKey y tomar cupo de cualquier evento (todos iguales por franja)
      const map = new Map();
      for (const ev of data.events || []) {
        if (!map.has(ev.slotKey)) {
          if (ev.isAdhocClass === true) {
            continue;
          }
          map.set(ev.slotKey, {
            slotKey: ev.slotKey,
            weekday: ev.weekday,
            start: new Date(ev.start),
            end: new Date(ev.end),
            status: ev.status,
            capacityLeft: ev.capacityLeft,
          });
        }
      }
      const arr = [...map.values()].sort(
        (a, b) => a.weekday - b.weekday || a.start - b.start
      );
      setSlots(arr);
      if (arr.length) {
        setChosenSlotKey(arr[0].slotKey);
      }
    } catch (e) {
      setErrorIns(e.message);
    } finally {
      setLoadingSlots(false);
    }
  }, [form.professorId, form.monthStr]);

  useEffect(() => {
    reloadSlots();
  }, [reloadSlots]);

  async function submitInscripcion(e) {
    e.preventDefault();
    setErrorIns("");
    setResultIns(null);
    try {
      if (!chosenSlotKey) throw new Error("Seleccioná una franja");
      const { y, m } = monthInputValueToParts(form.monthStr);
      const payload = {
        name: form.name,
        email: form.email,
        password: form.password,
        professorId: form.professorId,
        branch: branchId,
        year: y,
        month: m,
        slotKey: chosenSlotKey,
      };
      const res = await fetch(`/api/${branchId}/students/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Error creando inscripción");
      setResultIns(data);
    } catch (err) {
      setErrorIns(err.message);
    }
  }

  const slotOptions = useMemo(
    () =>
      slots.map((s) => ({
        value: s.slotKey,
        label: `${WEEKDAYS[s.weekday]} ${s.start.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}–${s.end.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })} (${s.capacityLeft > 0 ? `Disp. ${s.capacityLeft}` : "Completo"})`,
      })),
    [slots]
  );

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-10">
      <h1 className="text-2xl font-semibold">
        Alta de Estudiante, Asignación de Horario y Reprogramación
      </h1>

      {/* A) Crear + Inscribir */}
      <section className="bg-white rounded-2xl shadow p-5 space-y-4">
        <h2 className="text-lg font-medium">
          Crear estudiante y asignar 1 clase semanal
        </h2>
        <form onSubmit={submitInscripcion} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="flex flex-col">
              <span className="text-sm text-gray-600 mb-1">Name</span>
              <input
                className="border rounded-lg px-3 py-2"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                required
              />
            </label>
            <label className="flex flex-col">
              <span className="text-sm text-gray-600 mb-1">Email</span>
              <input
                type="email"
                className="border rounded-lg px-3 py-2"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
                required
              />
            </label>
            <label className="flex flex-col">
              <span className="text-sm text-gray-600 mb-1">Contraseña</span>
              <input
                className="border rounded-lg px-3 py-2"
                value={form.password}
                onChange={(e) =>
                  setForm((f) => ({ ...f, password: e.target.value }))
                }
              />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="flex flex-col">
              <span className="text-sm text-gray-600 mb-1">Profesor</span>
              <select
                className="border rounded-lg px-3 py-2"
                value={form.professorId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, professorId: e.target.value }))
                }
                required
              >
                <option value="">— Elegir —</option>
                {professors.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col">
              <span className="text-sm text-gray-600 mb-1">Mes</span>
              <input
                type="month"
                className="border rounded-lg px-3 py-2"
                value={form.monthStr}
                onChange={(e) =>
                  setForm((f) => ({ ...f, monthStr: e.target.value }))
                }
                required
              />
            </label>
            <div className="flex items-end">
              <button
                type="button"
                onClick={reloadSlots}
                className="px-4 py-2 rounded-lg border"
              >
                Ver franjas
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-sm text-gray-600">
              Franjas disponibles (1 por semana):
            </span>
            {loadingSlots && <div className="text-sm">Cargando franjas…</div>}
            {slots.length === 0 && !loadingSlots && (
              <div className="text-sm text-gray-500">
                Seleccioná professor y mes para ver opciones.
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {slotOptions.map((opt) => (
                <label
                  key={opt.value}
                  className={`border rounded-xl px-3 py-2 flex items-center gap-2 ${
                    chosenSlotKey === opt.value
                      ? "bg-gray-50 border-gray-400"
                      : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="slot"
                    value={opt.value}
                    checked={chosenSlotKey === opt.value}
                    onChange={() => setChosenSlotKey(opt.value)}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="px-4 py-2 rounded-xl bg-black text-white">
              Crear e inscribir
            </button>
            {errorIns && <p className="text-sm text-red-600">{errorIns}</p>}
            {resultIns?.ok && (
              <p className="text-sm text-green-700">
                Inscripción creada (ID: {resultIns.enrollmentId})
              </p>
            )}
          </div>
        </form>
      </section>
    </main>
  );
}
