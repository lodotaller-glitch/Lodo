"use client";
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import Swal from "sweetalert2";
import api from "@/lib/axios";

const BRAND = { main: "#A08775", soft: "#DDD7C9", text: "#1F1C19" };

export default function AdhocClassesPage() {
  const { id: professorId, branchId, professorName } = useParams();
  const [classes, setClasses] = useState([]);

  const [date, setDate] = useState(null);
  const [startHour, setStartHour] = useState(12);
  const [startMinute, setStartMinute] = useState(0);
  const [endHour, setEndHour] = useState(13);
  const [endMinute, setEndMinute] = useState(0);
  const [capacity, setCapacity] = useState(10);

  const now = new Date();
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (professorId) fetchClasses();
  }, [professorId, branchId, filterMonth, filterYear]);

  async function fetchClasses() {
    setLoading(true);
    try {
      const res = await api.get(
        `/${branchId}/professors/${professorId}/adhoc-classes`,
        { params: { year: filterYear, month: filterMonth } }
      );
      setClasses(res.data.classes || []);
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "No se pudieron cargar las clases", "error");
    } finally {
      setLoading(false);
    }
  }

  async function createClass(e) {
    e.preventDefault();
    if (!date) return Swal.fire("Elegí una fecha", "", "warning");

    const startMin = startHour * 60 + startMinute;
    const endMin = endHour * 60 + endMinute;
    if (endMin <= startMin)
      return Swal.fire(
        "Horario inválido",
        "La hora de fin debe ser posterior al inicio.",
        "error"
      );

    const payload = {
      date: date.toISOString(),
      slotSnapshot: { dayOfWeek: date.getUTCDay(), startMin, endMin },
      capacity: Number(capacity),
      branchId,
    };

    try {
      await api.post(
        `/${branchId}/professors/${professorId}/adhoc-classes`,
        payload
      );
      setDate(null);
      await fetchClasses();
      Swal.fire(
        "Clase creada",
        "La clase ad-hoc fue creada con éxito.",
        "success"
      );
    } catch (err) {
      Swal.fire(
        "Error",
        err.response?.data?.error || "No se pudo crear la clase",
        "error"
      );
    }
  }

  async function deleteClass(id) {
    const confirm = await Swal.fire({
      title: "¿Eliminar clase?",
      text: "Esta acción no se puede deshacer",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ef4444",
      reverseButtons: true,
      focusCancel: true,
    });
    if (!confirm.isConfirmed) return;

    try {
      await api.delete(`/${branchId}/adhoc-classes/${id}`);
      await fetchClasses();
      Swal.fire("Eliminada", "La clase fue eliminada con éxito", "success");
    } catch {
      Swal.fire("Error", "No se pudo eliminar la clase", "error");
    }
  }

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div
        className="rounded-2xl border px-4 py-3 sm:px-6"
        style={{
          borderColor: BRAND.soft,
          background: `linear-gradient(180deg, ${BRAND.soft}55, transparent)`,
        }}
      >
        <h1 className="text-2xl font-semibold" style={{ color: BRAND.text }}>
          Clases Ad-hoc - {professorName}
        </h1>
        <p className="text-sm" style={{ color: `${BRAND.text}99` }}>
          Crear o eliminar clases fuera del calendario regular del profesor{" "}
          {professorName}.
        </p>
      </div>

      {/* Filtros */}
      <section
        className="space-y-3 rounded-2xl border p-4 sm:p-6"
        style={{ borderColor: BRAND.soft, background: "#fff" }}
      >
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label
              className="block text-sm font-medium mb-1"
              style={{ color: `${BRAND.text}CC` }}
            >
              Mes
            </label>
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(Number(e.target.value))}
              className="w-full rounded-xl border bg-white/90 px-3 py-2 shadow-sm outline-none focus:ring-2"
              style={{ borderColor: BRAND.soft, color: BRAND.text }}
            >
              {[...Array(12)].map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(0, i).toLocaleString("es-ES", { month: "long" })}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              className="block text-sm font-medium mb-1"
              style={{ color: `${BRAND.text}CC` }}
            >
              Año
            </label>
            <input
              type="number"
              value={filterYear}
              onChange={(e) => setFilterYear(Number(e.target.value))}
              className="w-full rounded-xl border bg-white/90 px-3 py-2 shadow-sm outline-none focus:ring-2"
              style={{ borderColor: BRAND.soft, color: BRAND.text }}
            />
          </div>
        </div>
      </section>

      {/* Crear clase */}
      <section
        className="space-y-4 rounded-2xl border p-4 sm:p-6"
        style={{ borderColor: BRAND.soft, background: "#fff" }}
      >
        <h3 className="text-lg font-semibold" style={{ color: BRAND.text }}>
          Nueva clase
        </h3>

        <form onSubmit={createClass} className="grid sm:grid-cols-2 gap-4">
          <div>
            <label
              className="block text-sm font-medium mb-1"
              style={{ color: `${BRAND.text}CC` }}
            >
              Fecha
            </label>
            <DatePicker
              selected={date}
              onChange={setDate}
              dateFormat="yyyy-MM-dd"
              className="w-full rounded-xl border bg-white/90 px-3 py-2 shadow-sm outline-none focus:ring-2"
              style={{ borderColor: BRAND.soft, color: BRAND.text }}
              placeholderText="Elegí una fecha"
            />
          </div>

          <div>
            <label
              className="block text-sm font-medium mb-1"
              style={{ color: `${BRAND.text}CC` }}
            >
              Capacidad
            </label>
            <input
              type="number"
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
              className="w-full rounded-xl border bg-white/90 px-3 py-2 shadow-sm outline-none focus:ring-2"
              style={{ borderColor: BRAND.soft, color: BRAND.text }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Hora inicio
            </label>
            <input
              type="time"
              value={`${String(startHour).padStart(2, "0")}:${String(
                startMinute
              ).padStart(2, "0")}`}
              onChange={(e) => {
                const [h, m] = e.target.value.split(":").map(Number);
                setStartHour(h);
                setStartMinute(m);
              }}
              className="w-full rounded-xl border px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Hora fin</label>
            <input
              type="time"
              value={`${String(endHour).padStart(2, "0")}:${String(
                endMinute
              ).padStart(2, "0")}`}
              onChange={(e) => {
                const [h, m] = e.target.value.split(":").map(Number);
                setEndHour(h);
                setEndMinute(m);
              }}
              className="w-full rounded-xl border px-3 py-2"
            />
          </div>

          <div className="sm:col-span-2 flex justify-end">
            <button
              type="submit"
              className="rounded-xl px-4 py-2 font-semibold shadow-sm transition hover:brightness-95"
              style={{ background: BRAND.main, color: "#fff" }}
            >
              Crear clase
            </button>
          </div>
        </form>
      </section>

      {/* Listado */}
      <section
        className="rounded-2xl border p-4 sm:p-6 space-y-3"
        style={{ borderColor: BRAND.soft, background: "#fff" }}
      >
        <h3 className="text-lg font-semibold" style={{ color: BRAND.text }}>
          Clases del mes
        </h3>

        {loading ? (
          <p className="text-sm text-gray-500">Cargando clases...</p>
        ) : classes.length === 0 ? (
          <p className="text-sm text-gray-500">No hay clases en este mes.</p>
        ) : (
          <ul className="divide-y">
            {classes.map((c) => (
              <li
                key={c._id}
                className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <strong>
                    {new Date(c.date).toLocaleDateString("es-AR", {
                      timeZone: "UTC",
                    })}{" "}
                    — {Math.floor(c.slotSnapshot.startMin / 60)}:
                    {String(c.slotSnapshot.startMin % 60).padStart(2, "0")} /{" "}
                    {Math.floor(c.slotSnapshot.endMin / 60)}:
                    {String(c.slotSnapshot.endMin % 60).padStart(2, "0")}
                  </strong>
                  <p className="text-sm text-gray-600">
                    {c.students?.length || 0} / {c.capacity} alumnos
                  </p>
                </div>
                <button
                  onClick={() => deleteClass(c._id)}
                  className="mt-2 sm:mt-0 rounded-xl border px-3 py-1 text-sm font-medium transition hover:bg-red-50"
                  style={{
                    borderColor: "#FCA5A5",
                    color: "#991B1B",
                    background: "#fff",
                  }}
                >
                  Eliminar
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function convertMinutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins
    .toString()
    .padStart(2, "0")}`;
}

function convertTimeToMinutes(time) {
  const [hours, mins] = time.split(":").map(Number);
  return hours * 60 + mins;
}
