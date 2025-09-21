"use client";
import { useRouter } from "next/navigation";
import { use, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { addHours, format } from "date-fns";
import es from "date-fns/locale/es";
import QRScanner from "@/components/QrScann/QRScanner";

const BRAND = { main: "#A08775", soft: "#DDD7C9", text: "#1F1C19" };

function extractClassKey(text) {
  try {
    const url = new URL(text);
    return url.searchParams.get("k") || url.searchParams.get("c") || "";
  } catch {
    return (text || "").trim();
  }
}

export default function MyClassPage({ searchParams }) {
  // Aceptar tanto professorId (en) como profesorId (es) — a veces lo pasaste como "profesorId"
  const sp = use(searchParams);
  const start = sp?.start || null;
  const professorId = sp?.professorId || sp?.profesorId || null;

  const { user } = useAuth();
  const router = useRouter();

  const startDate = start ? new Date(start) : null;

  const [feedback, setFeedback] = useState(null); // { type: 'success'|'error'|'info', text }
  const [code, setCode] = useState("");
  const [marking, setMarking] = useState(false);

  // estado de asistencia / reprogramación
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [attended, setAttended] = useState(false);
  const [reschedulable, setReschedulable] = useState(true);
  const [tooOld, setTooOld] = useState(false);

  // --------- cargar estado de la clase para el alumno ----------
  useEffect(() => {
    async function loadStatus() {
      if (!user?._id || !user?.branch || !start || !professorId) return;
      setStatusLoading(true);
      setStatusError("");
      try {
        const url = new URL(
          `/api/${user.branch}/classes/status`,
          window.location.origin
        );
        url.searchParams.set("studentId", user._id);
        url.searchParams.set("professorId", professorId);
        url.searchParams.set("start", start);

        const res = await fetch(url.toString());
        const data = await res.json();
        if (!res.ok)
          throw new Error(data?.error || "No se pudo cargar el estado");

        setAttended(Boolean(data.attended));
        setReschedulable(Boolean(data.reschedulable));
        setTooOld(Boolean(data.tooOld));
      } catch (e) {
        setStatusError(e.message);
        setAttended(false);
        setReschedulable(false);
        setTooOld(false);
      } finally {
        setStatusLoading(false);
      }
    }
    loadStatus();
  }, [user?._id, user?.branch, start, professorId]);

  // --- cuando el scanner detecta algo ---
  const handleScan = async (raw) => {
    const classKey = extractClassKey(raw);
    if (!classKey) {
      setFeedback({ type: "error", text: "QR inválido" });
      return;
    }
    try {
      const res = await fetch("/api/class/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No se pudo marcar");
      setFeedback({ type: "success", text: "¡Asistencia registrada por QR!" });
      // si marcó asistencia, bloqueamos reprogramación inmediatamente
      setAttended(true);
      setReschedulable(false);
    } catch (e) {
      setFeedback({ type: "error", text: e.message || "No se pudo marcar" });
    }
  };

  const handleScanError = (e) => {
    const msg = typeof e === "string" ? e : e?.message || "Error de cámara";
    setFeedback({ type: "error", text: msg });
  };

  function handleReschedule() {
    if (!reschedulable) return;
    if (user && start && professorId) {
      router.push(
        `/student/my-class/reschedule?start=${encodeURIComponent(
          start
        )}&profesorId=${professorId}`
      );
    }
  }

  const borderSoft = { borderColor: BRAND.soft };

  // Mensaje estado asistencia
  const attendanceBadge = useMemo(() => {
    if (statusLoading) {
      return {
        bg: `${BRAND.soft}`,
        br: BRAND.soft,
        tx: BRAND.text,
        text: "Cargando estado…",
      };
    }
    if (statusError) {
      return {
        bg: "#FEF2F2",
        br: "#FECACA",
        tx: "#991B1B",
        text: "No se pudo cargar el estado",
      };
    }
    if (attended) {
      return {
        bg: "#ECFDF5",
        br: "#86EFAC",
        tx: "#166534",
        text: "Asistencia registrada",
      };
    }
    return {
      bg: `${BRAND.soft}`,
      br: BRAND.soft,
      tx: BRAND.text,
      text: "Pendiente / sin marcar",
    };
  }, [statusLoading, statusError, attended]);

  const showRescheduleButton = reschedulable && !statusLoading && !statusError;

  return (
    <main className="mx-auto max-w-2xl p-4 sm:p-6 space-y-6">
      {/* Encabezado */}
      <div
        className="rounded-2xl border"
        style={{
          ...borderSoft,
          background: `linear-gradient(180deg, ${BRAND.soft}55, transparent)`,
        }}
      >
        <div className="flex items-center justify-between px-4 py-3 sm:px-6">
          <h1
            className="text-xl font-semibold tracking-tight"
            style={{ color: BRAND.text }}
          >
            Mi clase
          </h1>
          {startDate && (
            <span
              className="rounded-full px-3 py-1 text-xs"
              style={{
                backgroundColor: BRAND.soft,
                color: BRAND.text,
                border: `1px solid ${BRAND.main}55`,
              }}
            >
              {format(addHours(startDate, 3), "PPPP p", { locale: es })}
            </span>
          )}
        </div>

        {/* Estado de asistencia */}
        <div className="px-4 pb-3 sm:px-6">
          {!reschedulable && !statusLoading && !statusError ? (
            <div
              role="alert"
              className="rounded-2xl border px-4 py-3 flex items-start gap-3"
              style={{
                background: `${BRAND.soft}66`,
                borderColor: BRAND.main,
                color: BRAND.text,
              }}
            >
              {/* Ícono */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mt-0.5 flex-shrink-0"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
                style={{ color: BRAND.main }}
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l6.518 11.6A2 2 0 0 1 16.518 18H3.482a2 2 0 0 1-1.743-3.3l6.518-11.6zM11 13a1 1 0 1 0-2 0 1 1 0 0 0 2 0zm-1-2a1 1 0 0 0 1-1V7a1 1 0 1 0-2 0v3a1 1 0 0 0 1 1z"
                  clipRule="evenodd"
                />
              </svg>

              <div className="min-w-0">
                <div
                  className="text-sm font-semibold"
                  style={{ color: BRAND.text }}
                >
                  No podés reprogramar esta clase
                </div>
                <div
                  className="mt-1 text-sm/relaxed"
                  style={{ color: `${BRAND.text}CC` }}
                >
                  {attended && "Ya registraste asistencia."}
                  {attended && tooOld && " "}
                  {!attended &&
                    tooOld &&
                    "Pasaron más de 7 días desde la clase."}
                  {!attended &&
                    !tooOld &&
                    "No disponible por las reglas del taller."}
                </div>

                {/* Etiquetas de motivo */}
                <div className="mt-2 flex flex-wrap gap-2">
                  {attended && (
                    <span
                      className="rounded-full px-2.5 py-0.5 text-xs"
                      style={{
                        background: BRAND.main,
                        color: "#fff",
                        border: `1px solid ${BRAND.main}`,
                      }}
                    >
                      Asistencia registrada
                    </span>
                  )}
                  {tooOld && (
                    <span
                      className="rounded-full px-2.5 py-0.5 text-xs"
                      style={{
                        background: BRAND.soft,
                        color: BRAND.text,
                        border: `1px solid ${BRAND.main}55`,
                      }}
                    >
                      Ventana de 7 días vencida
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <span
              className="rounded-full px-3 py-1 text-xs"
              style={{
                backgroundColor: BRAND.soft,
                border: `1px solid ${BRAND.main}55`,
                color: BRAND.text,
              }}
            >
              {attendanceBadge.text}
            </span>
          )}
        </div>
      </div>

      {/* Scanner con ZXing */}
      {user && showRescheduleButton && (
        <section
          className="rounded-2xl border p-4 shadow-2xl"
          style={borderSoft}
        >
          <h2
            className="mb-3 text-sm font-medium"
            style={{ color: `${BRAND.text}CC` }}
          >
            Escanear QR
          </h2>
          <div className="overflow-hidden rounded-xl border" style={borderSoft}>
            <QRScanner onResult={handleScan} onError={handleScanError} />
          </div>
          <p className="mt-2 text-xs" style={{ color: `${BRAND.text}99` }}>
            Apuntá al código QR del aula para registrar tu asistencia.
          </p>
          {feedback && (
            <div
              aria-live="polite"
              className="mt-3 rounded-xl border px-3 py-2 text-sm"
              style={{
                color:
                  feedback.type === "success"
                    ? "#166534"
                    : feedback.type === "error"
                    ? "#991B1B"
                    : BRAND.text,
                backgroundColor:
                  feedback.type === "success"
                    ? "#ECFDF5"
                    : feedback.type === "error"
                    ? "#FEF2F2"
                    : `${BRAND.soft}66`,
                borderColor:
                  feedback.type === "success"
                    ? "#86EFAC"
                    : feedback.type === "error"
                    ? "#FECACA"
                    : BRAND.soft,
              }}
            >
              {feedback.text}
            </div>
          )}
        </section>
      )}

      {/* Acciones secundarias */}
      {user && showRescheduleButton && (
        <div className="flex items-center gap-3">
          <button
            onClick={handleReschedule}
            className="rounded-xl border px-4 py-2 text-sm font-medium transition hover:shadow-sm"
            style={{
              borderColor: BRAND.main,
              backgroundColor: `${BRAND.soft}55`,
              color: BRAND.text,
            }}
          >
            Reprogramar clase
          </button>
        </div>
      )}
    </main>
  );
}
