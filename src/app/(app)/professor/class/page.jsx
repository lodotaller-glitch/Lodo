"use client";

import { useMemo, useEffect, useRef, useState, use } from "react";
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react"; // ★ también Canvas
import { useAuth } from "@/context/AuthContext";

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
  const { start, slot, enrollmentId } = use(searchParams); // ya viene por props
  const { user } = useAuth();
  const branchId = user?.branch;

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // ★ refs para imprimir/descargar
  const qrBoxRef = useRef(null);
  const qrCanvasRef = useRef(null);

  useEffect(() => {
    if (!user || !start || !slot) return;
    const controller = new AbortController();
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(
          `/api/${user.branch}/classes?start=${encodeURIComponent(
            start
          )}&slot=${encodeURIComponent(slot)}`,
          { signal: controller.signal }
        );
        const data = await res.json();
        if (res.ok) setStudents(data.students || []);
      } catch {}
      setLoading(false);
    })();
    return () => controller.abort();
  }, [user, start, slot]);

  function toggleAttendance(student) {
    if (!user) return;
    const updated = { ...student, present: !student.present };
    setStudents((arr) =>
      arr.map((s) =>
        s.id === student.id && s.origin === student.origin ? updated : s
      )
    );
    fetch(`/api/${user.branch}/classes`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enrollmentId: student.enrollmentId || null,
        studentId: student.id,
        professorId: parseSlot(slot).professorId,
        slot,
        start,
        present: !student.present,
        origin: student.origin || (student.enrollmentId ? "regular" : "adhoc"),
      }),
    }).catch(() => {});
  }

  function addStudent() {
    if (!user) return;
    const email = prompt("Email del estudiante");
    if (!email) return;
    fetch(`/api/${user.branch}/classes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, start, slot }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data?.student) setStudents((arr) => [...arr, data.student]);
        else if (data?.error) alert(data.error);
      })
      .catch(() => {});
  }

  function removeStudent(id) {
    if (!user) return;
    const st = students.find((s) => s.id === id);
    if (!st) return;
    setStudents((arr) =>
      arr.filter((s) => !(s.id === id && s.origin === st.origin))
    );
    fetch(`/api/${user.branch}/classes`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enrollmentId: st.enrollmentId || null,
        studentId: st.id,
        professorId: parseSlot(slot).professorId,
        start,
        origin: st.origin || (st.enrollmentId ? "regular" : "adhoc"),
      }),
    }).catch(() => {});
  }

  // ----- QR directo al API -----
  const classKey = useMemo(() => {
    if (!start || !slot) return "";
    const b = user?.branch || branchId; // prioridad a branch logueada
    return buildClassKey({ branchId: b, startISO: start, slot, enrollmentId });
  }, [user?.branch, branchId, start, slot, enrollmentId]);

  const qrApiUrl = useMemo(() => {
    if (!classKey) return "";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/api/class/check?k=${classKey}`;
  }, [classKey]);

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(qrApiUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  }

  // ★ imprimir: abre una ventana con solo el SVG
  function printQR() {
    try {
      const svg = qrBoxRef.current?.querySelector("svg");
      if (!svg) return;

      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(svg);

      const { professorId } = parseSlot(slot || "-");
      const meta = `
        <div class="meta">
          <div><strong>Clase:</strong> ${
            start ? new Date(start).toLocaleString("es-AR") : ""
          }</div>
          <div><strong>Profesor:</strong> ${professorId || "—"}</div>
          <div><strong>URL:</strong> ${qrApiUrl}</div>
        </div>`;

      const html = `
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>QR de asistencia</title>
<style>
  @page { size: A4; margin: 16mm; }
  html,body { height: 100%; }
  body {
    display: flex; align-items: center; justify-content: center;
    font-family: system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial, "Noto Sans", "Liberation Sans", sans-serif;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .wrap { text-align: center; width: 100%; }
  .meta {
    position: fixed; top: 16mm; left: 16mm; right: 16mm;
    font-size: 12pt; color: #222; line-height: 1.35;
  }
  /* tamaño del QR en papel */
  svg { width: 95mm; height: 95mm; }
</style>
</head>
<body>
  <div class="wrap">
    ${meta}
    ${svgString}
  </div>
  <script>window.onload = () => setTimeout(()=>window.print(), 50);</script>
</body>
</html>`;
      const w = window.open("", "_blank", "noopener,noreferrer");
      if (!w) return;
      w.document.open();
      w.document.write(html);
      w.document.close();
    } catch {}
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

  const dtf = useMemo(
    () =>
      new Intl.DateTimeFormat("es-AR", {
        dateStyle: "full",
        timeStyle: "short",
      }),
    []
  );
  const startStr = start ? dtf.format(new Date(start)) : "";

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
        className="rounded-2xl border p-4 shadow-sm sm:p-6"
        style={{ borderColor: BRAND.soft }}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold" style={{ color: BRAND.text }}>
            Asistencia
          </h2>
          <button
            onClick={addStudent}
            className="rounded-xl px-3 py-1.5 text-sm font-medium shadow-sm transition hover:shadow"
            style={{ backgroundColor: BRAND.main, color: "#fff" }}
          >
            Agregar alumno
          </button>
        </div>

        {students.length === 0 ? (
          <div
            className="mt-4 rounded-xl border border-dashed p-4 text-sm text-center"
            style={{ borderColor: `${BRAND.main}55`, color: `${BRAND.text}99` }}
          >
            No hay alumnos en esta clase todavía.
          </div>
        ) : (
          <ul className="mt-3 divide-y" style={{ borderColor: BRAND.soft }}>
            {students.map((s) => (
              <li
                key={`${s.id}-${s.origin || "regular"}`}
                className="flex items-center justify-between gap-3 py-2"
              >
                <label className="flex min-w-0 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={s.present}
                    onChange={() => toggleAttendance(s)}
                    className="h-4 w-4"
                    style={{ accentColor: BRAND.main }}
                  />
                  <span className="truncate" style={{ color: BRAND.text }}>
                    {s.name}
                  </span>
                  {s.origin === "adhoc" && (
                    <span
                      className="rounded-full px-2 py-0.5 text-xs"
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
                <button
                  onClick={() => removeStudent(s.id)}
                  className="rounded-lg px-2 py-1 text-xs transition hover:shadow-sm"
                  style={{
                    border: `1px solid ${BRAND.main}`,
                    backgroundColor: `${BRAND.soft}55`,
                    color: BRAND.text,
                  }}
                >
                  Quitar
                </button>
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
              onClick={printQR} // ★ imprimir
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

          <div className="text-sm" style={{ color: `${BRAND.text}99` }}>
            <div className="mb-2">
              URL:{" "}
              <code className="rounded bg-black/5 px-1.5 py-0.5">
                {qrApiUrl}
              </code>
            </div>
            <button
              onClick={copyUrl}
              className="rounded-lg border px-2 py-1 text-xs"
              style={{ borderColor: BRAND.main, color: BRAND.text }}
            >
              {copied ? "¡Copiado!" : "Copiar enlace"}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
