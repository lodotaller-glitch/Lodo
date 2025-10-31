"use client";

import { useMemo, useEffect, useRef, useState, use } from "react";
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react"; // ★ también Canvas
import { useAuth } from "@/context/AuthContext";
import { useParams } from "next/navigation";
import { addHours } from "date-fns";

const BRAND = { main: "#A08775", soft: "#DDD7C9", text: "#1F1C19" };

function parseSlot(slot) {
  const [professorId, dayOfWeek, startMin, endMin] = (slot || "")
    .split("-")
    .map(String);
  return {
    professorId,
    dayOfWeek: Number(dayOfWeek),
    startMin: Number(startMin),
    endMin: Number(endMin),
  };
}

// base64url del JSON { b, st, sl, e? }
function buildClassKey({ branchId, startISO, slot, enrollmentId }) {
  const obj = { b: String(branchId), st: startISO, sl: slot };
  if (enrollmentId) obj.e = String(enrollmentId); // opcional
  const json = JSON.stringify(obj);
  const b64 = btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return b64;
}

export default function ProfessorClassPage({ searchParams }) {
  const { start, slot, enrollmentId, adhoc } = use(searchParams); // ya viene por props
  const { user } = useAuth();
  const { branchId } = useParams();

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  // ★ refs para imprimir/descargar
  const qrBoxRef = useRef(null);
  const qrCanvasRef = useRef(null);

  useEffect(() => {
    if (!user || !start || !slot || !branchId) return;
    const controller = new AbortController();
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(
          `/api/${branchId}/classes?start=${encodeURIComponent(
            start
          )}&slot=${encodeURIComponent(slot)}&adhoc=${encodeURIComponent(
            adhoc
          )}`,
          { signal: controller.signal }
        );
        const data = await res.json();
        if (res.ok) setStudents(data.students || []);
      } catch {}
      setLoading(false);
    })();
    return () => controller.abort();
  }, [user, start, slot, branchId]);

  function toggleAttendance(student) {
    if (!user || !branchId) return;
    const updated = { ...student, present: !student.present };
    setStudents((arr) =>
      arr.map((s) =>
        s._id === student._id && s.origin === student.origin ? updated : s
      )
    );
    fetch(`/api/${branchId}/classes`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enrollmentId: student.enrollmentId || null,
        studentId: student._id,
        professorId: parseSlot(slot).professorId,
        slot,
        start,
        present: !student.present,
        origin: student.origin || (student.enrollmentId ? "regular" : "adhoc"),
      }),
    }).catch(() => {});
  }

  function addStudent() {
    if (!user || !branchId) return;
    const email = prompt("Email del estudiante");
    if (!email) return;
    fetch(`/api/${branchId}/classes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, start, slot, adhoc }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data?.student) setStudents((arr) => [...arr, data.student]);
        else if (data?.error) alert(data.error);
      })
      .catch(() => {});
  }

  function removeStudent(id) {
    if (!user || !branchId) return;
    const st = students.find((s) => s._id === id);
    if (!st) return;
    setStudents((arr) =>
      arr.filter((s) => !(s._id === id && s.origin === st.origin))
    );

    fetch(`/api/${branchId}/classes`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enrollmentId: st.enrollmentId || null,
        studentId: st._id,
        professorId: parseSlot(slot).professorId,
        start,
        origin: st.origin || (st.enrollmentId ? "regular" : "adhoc"),
        slot,
      }),
    }).catch(() => {});
  }

  // ----- QR directo al API -----
  const classKey = useMemo(() => {
    if (!start || !slot) return "";
    const b = branchId || user?.branch; // prioridad a branch logueada
    return buildClassKey({ branchId: b, startISO: start, slot, enrollmentId });
  }, [user?.branch, branchId, start, slot, enrollmentId]);

  const qrApiUrl = useMemo(() => {
    if (!classKey) return "";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/api/class/check?k=${classKey}&adhoc=${adhoc}`;
  }, [classKey]);

  const dtf = useMemo(
    () =>
      new Intl.DateTimeFormat("es-AR", {
        dateStyle: "full",
        timeStyle: "short",
      }),
    []
  );

  const startStr = start ? dtf.format(addHours(new Date(start), 3)) : "";
  // ★ imprimir: abre una ventana con solo el SVG
  // reemplazá tu printQR por esta:
  function printQRInPlace() {
    try {
      const svg = qrBoxRef.current?.querySelector("svg");
      const clone = svg?.cloneNode(true);
      if (!clone) {
        alert("No se pudo encontrar el QR");
        return;
      }

      // Paleta (usa BRAND si existe, con fallback)
      const BRAND_MAIN = (typeof BRAND === "object" && BRAND.main) || "#A08775";
      const BRAND_SOFT = (typeof BRAND === "object" && BRAND.soft) || "#DDD7C9";
      const BRAND_TEXT = (typeof BRAND === "object" && BRAND.text) || "#1F1C19";

      // Asegurar namespace y tamaño físico
      if (!clone.getAttribute("xmlns")) {
        clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      }
      clone.setAttribute("width", "95mm");
      clone.setAttribute("height", "95mm");
      clone.setAttribute("preserveAspectRatio", "xMidYMid meet");
      clone.setAttribute("shape-rendering", "crispEdges");

      const mount = document.createElement("div");
      mount.id = "print-root";

      // Fecha/hora (si existe start)
      const when = startStr;

      mount.innerHTML = `
      <style>
        @page { size: A4 portrait; margin: 12mm; }
        @media print {
          html, body { height: auto !important; margin: 0 !important; }
          /* Colores reales en impresión */
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          color-adjust: exact;
          /* Ocultar todo excepto el root */
          body > :not(#print-root) { display: none !important; }
          #print-root { display: block !important; }
        }
        * { box-sizing: border-box; }
          @page { size: auto; margin: 12mm; }
        @media print {
          html, body { height: auto !important; margin: 0 !important; }
          body > :not(#print-root) { display: none !important; }
          #print-root { display: block !important; break-inside: avoid; page-break-inside: avoid; }
        }
      </style>
          

      <div style="
        display:flex; flex-direction:column; align-items:center; gap:8mm;
        font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
        color:${BRAND_TEXT};
      ">
        <header style="text-align:center">
          <div style="font-weight:800; font-size:22pt; letter-spacing:.2px;">Taller de Cerámica</div>
          ${
            when
              ? `<div style="margin-top:2mm; font-size:12pt; opacity:.85;">${when}</div>`
              : ""
          }
        </header>

        <div style="
          padding:7mm;
          border: 1mm solid ${BRAND_MAIN};
          border-radius: 6mm;
          background: #fff;
          box-shadow: 0 0 0 2mm ${BRAND_SOFT};
          display:inline-flex; align-items:center; justify-content:center;
        ">
          <div data-hook="qr-slot"></div>
        </div>

        <footer style="text-align:center; max-width:140mm; font-size:10pt; opacity:.8;">
          Presentá este código en el aula para registrar tu asistencia.
          Mantené el QR plano, limpio y sin dobleces para una lectura rápida.
        </footer>
      </div>
    `;

      // Insertar el SVG clonado
      const slot = mount.querySelector('[data-hook="qr-slot"]');
      slot.appendChild(clone);

      // Inyectar al principio del body para evitar reflows raros
      document.body.prepend(mount);

      const cleanup = () => {
        mount.remove();
        window.removeEventListener("afterprint", cleanup);
      };
      window.addEventListener("afterprint", cleanup);

      window.print();
    } catch (e) {
      console.error("printQRInPlace error", e);
      alert("No se pudo preparar la impresión del QR.");
    }
  }

  // ★ descargar PNG usando un canvas oculto con alta resolución
  function downloadPng() {
    try {
      const dataUrl = qrCanvasRef.current?.toDataURL("image/png");
      if (!dataUrl) return;
      const a = document.createElement("a");
      const { professorId } = parseSlot(slot || "-");
      const dateStr = start
        ? new Date(start).toISOString().replaceAll(":", "").replaceAll(".", "")
        : "qr";
      a.href = dataUrl;
      a.download = `qr-${professorId || "prof"}-${dateStr}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {}
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl p-4 sm:p-6">
        <div className="mb-4 h-8 w-52 animate-pulse rounded-xl bg-black/10" />
        <ul className="grid gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <li
              key={i}
              className="rounded-2xl border p-4"
              style={{ borderColor: BRAND.soft }}
            >
              <div className="h-14 w-full animate-pulse rounded-xl bg-black/5" />
            </li>
          ))}
        </ul>
      </main>
    );
  }
  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-6 space-y-6">
      {/* Encabezado */}
      <div
        className="rounded-2xl border"
        style={{
          borderColor: BRAND.soft,
          background: `linear-gradient(180deg, ${BRAND.soft}55, transparent)`,
        }}
      >
        <div className="flex items-center justify-between px-4 py-3 sm:px-6">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: BRAND.text }}>
              Clase
            </h1>
            {start && (
              <p className="text-sm" style={{ color: `${BRAND.text}99` }}>
                {startStr}
              </p>
            )}
          </div>
          <span
            className="rounded-full px-3 py-1 text-xs"
            style={{
              backgroundColor: BRAND.soft,
              color: BRAND.text,
              border: `1px solid ${BRAND.main}55`,
            }}
          >
            {parseSlot(slot || "-").professorId || "—"}
          </span>
        </div>
      </div>

      {/* Asistencia */}
      <section
        className="rounded-2xl border shadow-sm p-5 sm:p-6"
        style={{
          borderColor: BRAND.soft,
          background: `linear-gradient(180deg, ${BRAND.soft}33, #ffffff)`,
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <h2
            className="text-base sm:text-lg font-semibold tracking-tight"
            style={{ color: BRAND.text }}
          >
            Asistencia
          </h2>
          <button
            onClick={addStudent}
            className="rounded-xl px-3.5 py-2 text-sm font-medium shadow-sm transition hover:shadow md:active:translate-y-[1px] focus:outline-none focus:ring-2"
            style={{
              backgroundColor: BRAND.main,
              color: "#fff",
              boxShadow: "0 1px 1px rgba(0,0,0,.05)",
            }}
          >
            Agregar alumno
          </button>
        </div>

        {students.length === 0 ? (
          <div
            className="mt-4 rounded-2xl border border-dashed p-6 text-sm text-center"
            style={{ borderColor: `${BRAND.main}66`, color: `${BRAND.text}99` }}
          >
            <div
              className="mx-auto mb-2 h-8 w-8 rounded-full"
              style={{ background: `${BRAND.soft}` }}
            />
            No hay alumnos en esta clase todavía.
          </div>
        ) : (
          <ul
            className="mt-3 divide-y rounded-xl border bg-white/70"
            style={{ borderColor: BRAND.soft }}
          >
            {students.map((s, i) => (
              <li
                key={`${s._id}-${s.origin || "regular"}-${i}`}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 px-3 py-2 sm:px-4 hover:bg-black/[.02] transition"
              >
                <label className="flex min-w-0 items-center justify-center sm:justify-start gap-3 flex-1">
                  <input
                    type="checkbox"
                    checked={s.present}
                    onChange={() => toggleAttendance(s)}
                    className="h-4 w-4 rounded focus:outline-none focus:ring-2 shrink-0"
                    style={{ accentColor: BRAND.main }}
                  />
                  <span
                    className="font-medium leading-tight break-words sm:truncate"
                    style={{ color: BRAND.text }}
                  >
                    {s.name}
                  </span>

                  {s.origin === "adhoc" && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[11px] uppercase tracking-wide shrink-0"
                      style={{
                        backgroundColor: `${BRAND.soft}`,
                        border: `1px solid ${BRAND.main}55`,
                        color: BRAND.text,
                      }}
                    >
                      ad-hoc
                    </span>
                  )}
                </label>

                <div className="mt-2 sm:mt-0 ml-0 sm:ml-auto flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  {s.enrollmentId && s.payState ? (
                    <span
                      className="rounded-full px-2.5 py-0.5 text-xs font-medium shrink-0"
                      style={{
                        backgroundColor:
                          s.payState === "pagado"
                            ? "#DCFCE7"
                            : s.payState === "señado"
                            ? "#FEF9C3"
                            : s.payState === "cancelado"
                            ? "#FEE2E2"
                            : "#F3F4F6",
                        border:
                          s.payState === "pagado"
                            ? "1px solid #16A34A55"
                            : s.payState === "señado"
                            ? "1px solid #CA8A0455"
                            : s.payState === "cancelado"
                            ? "1px solid #B91C1C55"
                            : "1px solid #9CA3AF55",
                        color:
                          s.payState === "pagado"
                            ? "#065F46"
                            : s.payState === "señado"
                            ? "#92400E"
                            : s.payState === "cancelado"
                            ? "#7F1D1D"
                            : "#374151",
                      }}
                      title={`Estado de pago: ${s.payState || "pendiente"}`}
                    >
                      {s.payState === "pagado"
                        ? "Pagado"
                        : s.payState === "señado"
                        ? "Señado"
                        : s.payState === "cancelado"
                        ? "Cancelado"
                        : "Pendiente"}
                    </span>
                  ) : null}

                  {s._id ? (
                    <a
                      href={`/${branchId}/students/${s._id}/edit`}
                      className="rounded-lg px-2 py-1 text-xs transition hover:bg-black/[.04] focus:outline-none focus:ring-2 shrink-0"
                      style={{ color: BRAND.main }}
                    >
                      Editar
                    </a>
                  ) : null}

                  <button
                    onClick={() => removeStudent(s._id)}
                    className="rounded-lg px-2 py-1 text-xs transition hover:shadow-sm focus:outline-none focus:ring-2 shrink-0"
                    style={{
                      border: `1px solid ${BRAND.main}`,
                      backgroundColor: `${BRAND.soft}66`,
                      color: BRAND.text,
                    }}
                  >
                    Quitar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* QR directo al API */}
      <section
        className="rounded-2xl border p-4 shadow-sm sm:p-6"
        style={{ borderColor: BRAND.soft }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold" style={{ color: BRAND.text }}>
            QR de asistencia
          </h2>
          <div className="flex gap-2">
            <button
              onClick={printQRInPlace} // ★ imprimir
              className="rounded-xl border px-3 py-1.5 text-sm font-medium transition hover:shadow-sm"
              style={{
                borderColor: BRAND.main,
                backgroundColor: "#fff",
                color: BRAND.text,
              }}
            >
              Imprimir QR
            </button>
            <button
              onClick={downloadPng} // ★ descargar PNG
              className="rounded-xl px-3 py-1.5 text-sm font-medium shadow-sm transition hover:shadow"
              style={{ backgroundColor: BRAND.main, color: "#fff" }}
            >
              Descargar PNG
            </button>
          </div>
        </div>

        <p className="mt-1 text-sm" style={{ color: `${BRAND.text}99` }}>
          Al escanearlo, el teléfono llamará automáticamente al endpoint y
          marcará asistencia.
        </p>

        <div className="mt-3 grid gap-4 sm:grid-cols-[auto,1fr] sm:items-center">
          <div
            ref={qrBoxRef} // ★ donde está el SVG para imprimir
            className="flex items-center justify-center rounded-xl border p-4"
            style={{ borderColor: BRAND.soft }}
          >
            {qrApiUrl ? (
              <QRCodeSVG value={qrApiUrl} size={220} includeMargin />
            ) : (
              <span className="text-sm" style={{ color: `${BRAND.text}99` }}>
                Generando QR…
              </span>
            )}
          </div>

          {/* ★ canvas oculto para generar PNG nítido */}
          <div style={{ position: "absolute", left: -99999, top: -99999 }}>
            {qrApiUrl && (
              <QRCodeCanvas
                value={qrApiUrl}
                size={1024}
                includeMargin
                ref={qrCanvasRef}
              />
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
