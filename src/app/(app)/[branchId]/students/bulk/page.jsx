// app/[branchId]/students/bulk/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

const BRAND = { main: "#A08775", soft: "#DDD7C9", text: "#1F1C19" };
const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
function ymToMonthInputValue(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
function monthInputValueToParts(value) {
  const [y, m] = value.split("-").map(Number);
  return { y, m };
}
function timeLabel(min) {
  const h = Math.floor(min / 60),
    mi = min % 60;
  return `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
}

export default function BulkStudentsPage() {
  const params = useParams();
  const branchId = params?.branchId;

  const [monthStr, setMonthStr] = useState(ymToMonthInputValue(new Date()));
  const { y: year, m: month } = useMemo(
    () => monthInputValueToParts(monthStr),
    [monthStr]
  );

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null); // { items, suggestions }
  const [rows, setRows] = useState([]); // working rows with chosen assignment
  const [loadingPrev, setLoadingPrev] = useState(false);
  const [creating, setCreating] = useState(false);
  const [results, setResults] = useState([]); // per-row results

  async function handlePreview() {
    if (!file) return;
    setLoadingPrev(true);
    setPreview(null);
    setResults([]);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("year", String(year));
    fd.append("month", String(month));

    const res = await fetch(`/api/${branchId}/students/bulk/preview`, {
      method: "POST",
      body: fd,
    });
    const js = await res.json();
    setLoadingPrev(false);

    if (!res.ok) {
      alert(js?.error || "Error en preview");
      return;
    }
    // Combinar items con sugerencias y preseleccionar la 1ª disponible
    const assembled = (js.items || []).map((it, idx) => {
      const suggs = js.suggestions?.[idx] || [];
      const chosen = suggs.find((s) => s.capacityLeft > 0) || suggs[0] || null;
      return {
        ...it,
        suggestions: suggs,
        assignment: chosen
          ? {
              professorId: chosen.professorId,
              professorName: chosen.professorName,
              slot: chosen.slot,
              weekdayLabel: WEEKDAYS[chosen.slot.dayOfWeek],
              timeRangeLabel: `${timeLabel(chosen.slot.startMin)}–${timeLabel(
                chosen.slot.endMin
              )}`,
            }
          : null,
      };
    });

    setPreview(js);
    setRows(assembled);
  }

  function setRowAssignment(i, s) {
    setRows((prev) =>
      prev.map((r, idx) => {
        if (idx !== i) return r;
        const a = s
          ? {
              professorId: s.professorId,
              professorName: s.professorName,
              slot: s.slot,
              weekdayLabel: WEEKDAYS[s.slot.dayOfWeek],
              timeRangeLabel: `${timeLabel(s.slot.startMin)}–${timeLabel(
                s.slot.endMin
              )}`,
            }
          : null;
        return { ...r, assignment: a };
      })
    );
  }

  async function handleCreate() {
    setCreating(true);
    setResults([]);
    try {
      const payload = {
        year,
        month,
        students: rows.map((r) => ({
          name: r.name,
          email: r.email,
          password: r.password || null,
          assignment: r.assignment,
        })),
      };
      const res = await fetch(`/api/${branchId}/students/bulk/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const js = await res.json();
      if (!res.ok) throw new Error(js?.error || "Error creando");
      setResults(js.results || []);
    } catch (e) {
      alert(e.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div
        className="rounded-2xl border px-4 py-3 sm:px-6"
        style={{
          borderColor: BRAND.soft,
          background: `linear-gradient(180deg, ${BRAND.soft}55, transparent)`,
        }}
      >
        <h1
          className="text-2xl font-semibold tracking-tight"
          style={{ color: BRAND.text }}
        >
          Alta masiva de estudiantes
        </h1>
        <p className="mt-1 text-sm" style={{ color: `${BRAND.text}99` }}>
          Importá un Excel, previsualizá y asigná horarios sugeridos.
        </p>
      </div>

      {/* Paso 1: archivo + mes */}
      <section
        className="rounded-2xl border p-4 sm:p-5 space-y-4"
        style={{ borderColor: BRAND.soft, background: "#fff" }}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="flex flex-col">
            <span
              className="text-sm mb-1 font-medium"
              style={{ color: `${BRAND.text}CC` }}
            >
              Archivo Excel
            </span>
            <div
              className="rounded-xl border p-2.5 shadow-sm bg-white"
              style={{ borderColor: BRAND.soft }}
            >
              <input
                className="block w-full text-sm"
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>
            <span className="mt-1 text-xs" style={{ color: `${BRAND.text}99` }}>
              Formatos soportados: .xlsx, .xls
            </span>
          </label>

          <label className="flex flex-col">
            <span
              className="text-sm mb-1 font-medium"
              style={{ color: `${BRAND.text}CC` }}
            >
              Mes
            </span>
            <input
              type="month"
              value={monthStr}
              onChange={(e) => setMonthStr(e.target.value)}
              className="rounded-xl border bg-white px-3 py-2.5 shadow-sm outline-none transition focus:ring-2"
              style={{ borderColor: BRAND.soft, color: BRAND.text }}
            />
          </label>

          <div className="flex items-center md:mt-2">
            <button
              onClick={handlePreview}
              disabled={!file || loadingPrev}
              className="w-full rounded-xl px-4 py-2.5 font-semibold shadow-sm transition hover:brightness-95 disabled:opacity-60"
              style={{ background: BRAND.main, color: "#fff" }}
            >
              {loadingPrev ? "Procesando…" : "Previsualizar"}
            </button>
          </div>
        </div>

        <p className="text-xs" style={{ color: `${BRAND.text}99` }}>
          Columnas reconocidas: <code>Nombre y Apellido</code>,{" "}
          <code>Gmail</code>, y <code>Horario</code>
        </p>
      </section>

      {/* Paso 2: previsualización */}
      {rows.length > 0 && (
        <section
          className="rounded-2xl border p-4 sm:p-5 space-y-4"
          style={{ borderColor: BRAND.soft, background: "#fff" }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold" style={{ color: BRAND.text }}>
              Previsualización y asignación
            </h2>
            <span
              className="rounded-full px-2.5 py-0.5 text-xs"
              style={{
                backgroundColor: BRAND.soft,
                border: `1px solid ${BRAND.main}55`,
                color: BRAND.text,
              }}
            >
              {rows.length} alumnos
            </span>
          </div>

          <div
            className="overflow-x-auto rounded-xl border"
            style={{ borderColor: BRAND.soft }}
          >
            <table className="min-w-full text-sm">
              <thead style={{ background: `${BRAND.soft}66` }}>
                <tr>
                  <th className="text-left px-3 py-2">Alumno</th>
                  <th className="text-left px-3 py-2">Email</th>
                  <th className="text-left px-3 py-2">Preferencia</th>
                  <th className="text-left px-3 py-2">Sugerencia</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={i}
                    className="border-t"
                    style={{ borderColor: BRAND.soft }}
                  >
                    <td className="px-3 py-2">
                      <div
                        className="font-medium"
                        style={{ color: BRAND.text }}
                      >
                        {r.name}
                      </div>
                    </td>
                    <td
                      className="px-3 py-2"
                      style={{ color: `${BRAND.text}CC` }}
                    >
                      {r.email}
                    </td>
                    <td className="px-3 py-2">
                      {r.preference ? (
                        <span
                          className="rounded-full px-2.5 py-0.5"
                          style={{
                            backgroundColor: BRAND.soft,
                            border: `1px solid ${BRAND.main}55`,
                            color: BRAND.text,
                          }}
                        >
                          {WEEKDAYS[r.preference.dayOfWeek]}{" "}
                          {timeLabel(r.preference.startMin)}–
                          {timeLabel(r.preference.endMin)}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2 flex-wrap">
                        {(r.suggestions || []).map((s, idx) => {
                          const isActive =
                            r.assignment?.professorId === s.professorId &&
                            r.assignment?.slot?.dayOfWeek ===
                              s.slot.dayOfWeek &&
                            r.assignment?.slot?.startMin === s.slot.startMin &&
                            r.assignment?.slot?.endMin === s.slot.endMin;

                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setRowAssignment(i, s)}
                              className={`group rounded-2xl border px-3 py-2 shadow-sm transition hover:shadow ${
                                isActive ? "text-white" : ""
                              }`}
                              style={{
                                borderColor: isActive ? BRAND.main : BRAND.soft,
                                background: isActive ? BRAND.main : "#fff",
                              }}
                              title={
                                s.capacityLeft > 0 ? "Disponible" : "Completo"
                              }
                            >
                              <div className="text-left text-xs sm:text-[13px] leading-5">
                                <div className="font-medium truncate">
                                  {s.professorName}
                                </div>
                                <div className="opacity-80">
                                  {WEEKDAYS[s.slot.dayOfWeek]}{" "}
                                  {timeLabel(s.slot.startMin)}–
                                  {timeLabel(s.slot.endMin)}
                                </div>
                              </div>
                              <div
                                className="mt-1 text-[11px] inline-flex items-center gap-1 rounded-full px-2 py-0.5"
                                style={{
                                  background: isActive
                                    ? "#ffffff22"
                                    : BRAND.soft,
                                  border: `1px solid ${BRAND.main}55`,
                                  color: isActive ? "#fff" : BRAND.text,
                                }}
                              >
                                {s.capacityLeft > 0
                                  ? `Disp. ${s.capacityLeft}`
                                  : "Completo"}
                              </div>
                            </button>
                          );
                        })}
                        {(!r.suggestions || r.suggestions.length === 0) && (
                          <span className="text-gray-400">Sin sugerencias</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleCreate}
              className="rounded-xl px-4 py-2.5 font-semibold shadow-sm transition hover:brightness-95 disabled:opacity-60"
              style={{ background: BRAND.main, color: "#fff" }}
              disabled={creating}
            >
              {creating ? "Creando…" : "Crear cuentas e inscribir"}
            </button>
            {creating && (
              <div className="text-sm" style={{ color: `${BRAND.text}99` }}>
                Procesando…
              </div>
            )}
          </div>
        </section>
      )}

      {/* Paso 3: resultados */}
      {results.length > 0 && (
        <section
          className="rounded-2xl border p-4 sm:p-5 space-y-3"
          style={{ borderColor: BRAND.soft, background: "#fff" }}
        >
          <h2 className="text-lg font-semibold" style={{ color: BRAND.text }}>
            Resultados
          </h2>
          <ul className="text-sm space-y-2">
            {results.map((r, i) => (
              <li key={i}>
                <span
                  className="rounded-full px-2.5 py-0.5 mr-2 text-xs align-middle"
                  style={{
                    background: r.ok ? "#ECFDF5" : "#FEF2F2",
                    border: `1px solid ${r.ok ? "#86EFAC" : "#FECACA"}`,
                    color: r.ok ? "#166534" : "#991B1B",
                  }}
                >
                  {r.ok ? "OK" : "Error"}
                </span>
                <span style={{ color: BRAND.text }}>
                  {r.email}:{" "}
                  {r.ok
                    ? `Creado (enrollment: ${r.enrollmentId})`
                    : `Error: ${r.error}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
