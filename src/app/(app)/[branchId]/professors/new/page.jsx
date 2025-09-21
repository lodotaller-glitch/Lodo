// app/(admin)/profesores/nuevo/page.jsx
"use client";

import { useRouter } from "next/navigation";
import { use, useState } from "react";

const WEEKDAYS = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
];

export default function NewProfessorPage({ params }) {
  const { branchId } = use(params);
  const route = useRouter();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    capacity: 10,
    effectiveMonth: defaultMonthString(),
  });

  const [slots, setSlots] = useState([
    { dayOfWeek: 1, start: "12:00", end: "14:00" },
  ]);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  function defaultMonthString() {
    // YYYY-MM del mes actual
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }

  function updateField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function addSlot() {
    setSlots((s) => [...s, { dayOfWeek: 1, start: "16:00", end: "18:00" }]);
  }

  function removeSlot(idx) {
    setSlots((s) => s.filter((_, i) => i !== idx));
  }

  function updateSlot(idx, key, value) {
    setSlots((s) =>
      s.map((row, i) => (i === idx ? { ...row, [key]: value } : row))
    );
  }

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Validación rápida de cliente
      if (!form.name?.trim() || !form.email?.trim()) {
        setError("Completá name y email.");
        setLoading(false);
        return;
      }
      if (!slots.length) {
        setError("Agregá al menos una franja horaria.");
        setLoading(false);
        return;
      }
      for (const s of slots) {
        if (Number(s.dayOfWeek) < 0 || Number(s.dayOfWeek) > 6) {
          setError("Día de semana inválido en alguna franja.");
          setLoading(false);
          return;
        }
        if (!/^\d{2}:\d{2}$/.test(s.start) || !/^\d{2}:\d{2}$/.test(s.end)) {
          setError("Formato de hora inválido (usa HH:mm).");
          setLoading(false);
          return;
        }
        if (s.end <= s.start) {
          setError(
            "En alguna franja, la hora de fin debe ser mayor que la de inicio."
          );
          setLoading(false);
          return;
        }
      }

      const payload = {
        ...form,
        branch: branchId,
        capacity: Number(form.capacity || 10),
        slots: slots.map((s) => ({
          dayOfWeek: Number(s.dayOfWeek),
          start: s.start,
          end: s.end,
        })),
      };

      const res = await fetch(`/api/${branchId}/professors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Error creando profesor");
      }
      setResult(data);
      route.back();
    } catch (err) {
      setError(err.message || "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">
        Crear Profesor y Asignar Horario
      </h1>

      <form onSubmit={onSubmit} className="space-y-6">
        {/* Datos del profesor */}
        <section className="bg-white rounded-2xl shadow p-4 space-y-4">
          <h2 className="text-lg font-medium">Datos del profesor</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex flex-col">
              <span className="text-sm text-gray-600 mb-1">Nombre</span>
              <input
                className="border rounded-lg px-3 py-2"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                required
              />
            </label>

            <label className="flex flex-col">
              <span className="text-sm text-gray-600 mb-1">Email</span>
              <input
                type="email"
                className="border rounded-lg px-3 py-2"
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
                required
              />
            </label>

            <label className="flex flex-col">
              <span className="text-sm text-gray-600 mb-1">Contraseña</span>
              <input
                className="border rounded-lg px-3 py-2"
                value={form.password}
                onChange={(e) => updateField("password", e.target.value)}
              />
            </label>

            <label className="flex flex-col">
              <span className="text-sm text-gray-600 mb-1">
                Capacidad por franja
              </span>
              <input
                type="number"
                min={1}
                className="border rounded-lg px-3 py-2"
                value={form.capacity}
                onChange={(e) => updateField("capacity", e.target.value)}
              />
            </label>

            <label className="flex flex-col">
              <span className="text-sm text-gray-600 mb-1">
                Vigente desde (mes)
              </span>
              <input
                type="month"
                className="border rounded-lg px-3 py-2"
                value={form.effectiveMonth}
                onChange={(e) => updateField("effectiveMonth", e.target.value)}
                required
              />
            </label>
          </div>
        </section>

        {/* Franjas horarias */}
        <section className="bg-white rounded-2xl shadow p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Franjas semanales</h2>
            <button
              type="button"
              onClick={addSlot}
              className="px-3 py-2 rounded-lg bg-black text-white hover:opacity-90"
            >
              + Agregar franja
            </button>
          </div>

          <div className="space-y-3">
            {slots.map((s, idx) => (
              <div
                key={idx}
                className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end bg-gray-50 p-3 rounded-xl"
              >
                <label className="flex flex-col">
                  <span className="text-sm text-gray-600 mb-1">Día</span>
                  <select
                    className="border rounded-lg px-3 py-2"
                    value={s.dayOfWeek}
                    onChange={(e) =>
                      updateSlot(idx, "dayOfWeek", e.target.value)
                    }
                  >
                    {WEEKDAYS.map((w) => (
                      <option key={w.value} value={w.value}>
                        {w.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col">
                  <span className="text-sm text-gray-600 mb-1">Inicio</span>
                  <input
                    type="time"
                    className="border rounded-lg px-3 py-2"
                    value={s.start}
                    onChange={(e) => updateSlot(idx, "start", e.target.value)}
                  />
                </label>

                <label className="flex flex-col">
                  <span className="text-sm text-gray-600 mb-1">Fin</span>
                  <input
                    type="time"
                    className="border rounded-lg px-3 py-2"
                    value={s.end}
                    onChange={(e) => updateSlot(idx, "end", e.target.value)}
                  />
                </label>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => duplicateSlot(idx, slots, setSlots)}
                    className="px-3 py-2 rounded-lg border"
                    title="Duplicar"
                  >
                    Duplicar
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSlot(idx)}
                    className="px-3 py-2 rounded-lg border text-red-600"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-black text-white hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Creando..." : "Crear profesor"}
          </button>

          {error && <p className="text-red-600 text-sm">{error}</p>}
          {result?.ok && (
            <p className="text-green-700 text-sm">
              ¡Listo! Profesor creado (ID: {result.profesorId}) y horario
              asignado.
            </p>
          )}
        </div>
      </form>
    </main>
  );
}

// Helpers locales
function duplicateSlot(idx, slots, setSlots) {
  const s = slots[idx];
  setSlots((arr) => [...arr, { ...s }]);
}
