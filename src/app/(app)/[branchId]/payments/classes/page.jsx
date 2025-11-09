"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/axios";
import { ClipLoader } from "react-spinners";

const BRAND = { main: "#A08775", soft: "#DDD7C9", text: "#1F1C19" };

export default function ProfessorClassesPage({ params }) {
  const { branchId } = use(params);
  const router = useRouter();

  const [profs, setProfs] = useState([]);
  const [selectedProf, setSelectedProf] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(false);

  // 🧑‍🏫 Cargar profesores
  useEffect(() => {
    let ignore = false;
    async function loadProfs() {
      try {
        const q = new URLSearchParams();
        if (branchId) q.set("branchId", branchId);
        const { data } = await api.get(`/professors?${q.toString()}`);
        if (!ignore) setProfs(data.professors || []);
      } catch {
        console.error("Error al cargar profesores");
      }
    }
    loadProfs();
    return () => {
      ignore = true;
    };
  }, [branchId]);

  // 📅 Cargar clases según filtros
  useEffect(() => {
    async function loadClasses() {
      if (!year || !month) return;
      setLoading(true);
      try {
        const q = new URLSearchParams({ year, month });
        if (selectedProf) q.set("professor", selectedProf);
        const res = await api.get(
          `${branchId}/professors/classes?${q.toString()}`
        );
        if (res.statusText !== "OK")
          throw new Error("Error al obtener los datos");
        const js = res.data;
        setClasses(Array.isArray(js) ? js : []);
      } catch (err) {
        console.error(err);
        setClasses([]);
      } finally {
        setLoading(false);
      }
    }
    loadClasses();
  }, [year, month, selectedProf]);

  const formatted = useMemo(() => {
    const map = {};
    for (const item of classes) {
      const profId = item.professor?._id || "unknown";
      if (!map[profId]) {
        map[profId] = {
          professor: item.professor?.name || "Sin nombre",
          classes: [],
        };
      }
      map[profId].classes.push(item);
    }
    return Object.values(map).sort((a, b) =>
      a.professor.localeCompare(b.professor)
    );
  }, [classes]);

  return (
    <section className="space-y-6">
      {/* Header con botón atrás */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[color:var(--text)]">
            Clases por profesor
          </h1>
          <p className="text-sm text-gray-600">
            Visualizá las clases y la cantidad de alumnos por horario.
          </p>
        </div>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 rounded-xl text-white shadow"
          style={{ background: BRAND.main }}
        >
          ← Volver
        </button>
      </header>

      {/* 🧩 Filtros */}
      <div
        className="rounded-2xl border p-4 sm:p-5 shadow-sm flex flex-wrap gap-4 items-end"
        style={{
          borderColor: BRAND.soft,
          background: `linear-gradient(180deg, ${BRAND.soft}40, #ffffff)`,
        }}
      >
        <div>
          <label
            className="block text-sm font-medium mb-1"
            style={{ color: BRAND.text }}
          >
            Año
          </label>
          <select
            className="rounded-xl border px-3 py-2.5 text-sm shadow-sm outline-none focus:ring-2"
            style={{ borderColor: BRAND.soft, color: BRAND.text }}
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {Array.from(
              { length: 5 },
              (_, i) => new Date().getFullYear() - 2 + i
            ).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            className="block text-sm font-medium mb-1"
            style={{ color: BRAND.text }}
          >
            Mes
          </label>
          <select
            className="rounded-xl border px-3 py-2.5 text-sm shadow-sm outline-none focus:ring-2"
            style={{ borderColor: BRAND.soft, color: BRAND.text }}
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m.toString().padStart(2, "0")}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-[200px]">
          <label
            className="block text-sm font-medium mb-1"
            style={{ color: BRAND.text }}
          >
            Profesor
          </label>
          <select
            className="rounded-xl border px-3 py-2.5 text-sm shadow-sm outline-none focus:ring-2 w-full"
            style={{ borderColor: BRAND.soft, color: BRAND.text }}
            value={selectedProf}
            onChange={(e) => setSelectedProf(e.target.value)}
          >
            <option value="">Todos</option>
            {profs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 📊 Contenido principal */}
      <div className="bg-white rounded-2xl shadow p-6 min-h-[200px]">
        {loading ? (
          <div className="flex justify-center items-center h-40">
            <ClipLoader color={BRAND.main} size={45} />
          </div>
        ) : formatted.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            No hay clases para los filtros seleccionados.
          </div>
        ) : (
          formatted.map(({ professor, classes }) => (
            <div key={professor} className="mb-10">
              <h2
                className="text-xl font-semibold mb-4 border-b pb-2"
                style={{ borderColor: BRAND.soft, color: BRAND.text }}
              >
                {professor}
              </h2>

              <div
                className="overflow-hidden rounded-xl border"
                style={{ borderColor: BRAND.soft }}
              >
                <table className="min-w-full text-sm">
                  <thead
                    style={{
                      background: `${BRAND.soft}55`,
                      color: BRAND.text,
                    }}
                  >
                    <tr>
                      <th className="px-4 py-2 text-left">Día</th>
                      <th className="px-4 py-2 text-left">Inicio</th>
                      <th className="px-4 py-2 text-left">Fin</th>
                      <th className="px-4 py-2 text-left">Alumnos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classes
                      .sort(
                        (a, b) =>
                          a.dayOfWeek - b.dayOfWeek || a.startMin - b.startMin
                      )
                      .map((c, i) => (
                        <tr
                          key={i}
                          className="border-t hover:bg-gray-50 transition"
                        >
                          <td className="px-4 py-2">
                            {getDayName(c.dayOfWeek)}
                          </td>
                          <td className="px-4 py-2">
                            {formatTime(c.startMin)}
                          </td>
                          <td className="px-4 py-2">{formatTime(c.endMin)}</td>
                          <td className="px-4 py-2 font-semibold text-right">
                            {c.studentsCount}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

// Helpers
function getDayName(day) {
  const days = [
    "Domingo",
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado",
  ];
  return days[day] ?? "-";
}

function formatTime(mins) {
  const h = Math.floor(mins / 60)
    .toString()
    .padStart(2, "0");
  const m = (mins % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}
