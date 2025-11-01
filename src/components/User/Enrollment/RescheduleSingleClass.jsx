"use client";
import { useEffect, useState } from "react";
import {
  getEnrollmentOccurrences,
  getRescheduleOptions,
  createOrUpdateReschedule,
  removeOccurrenceApi,
} from "@/functions/request/enrollments";
import { useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { addHours, format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import Swal from "sweetalert2";
import { ClipLoader } from "react-spinners";
const BRAND = { main: "#A08775", soft: "#DDD7C9", text: "#1F1C19" };

export default function RescheduleSingleClass({ enrollment, onDone }) {
  const [occurrences, setOccurrences] = useState([]);
  const [selectedFrom, setSelectedFrom] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [branchId, setBranchId] = useState(null);
  const { user } = useAuth();
  const searchParams = useParams(); // hook siempre

  // const branchId = professor ? user?.branch : searchParams?.branchId;

  useEffect(() => {
    setBranchId(
      user.role === "professor" ? user?.branch : searchParams?.branchId
    );
  }, [user]);

  useEffect(() => {
    if (!branchId) return;
    if (!enrollment?._id) return;
    let alive = true;
    setLoading(true);
    setError("");
    getEnrollmentOccurrences(enrollment._id, branchId)
      .then(({ occurrences }) => {
        if (alive) setOccurrences(occurrences || []);
      })
      .catch((e) => {
        if (alive) setError(e?.message || "Error al cargar");
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [enrollment?._id, branchId]);

  async function reloadOccurrences() {
    try {
      setLoading(true);
      const { occurrences } = await getEnrollmentOccurrences(
        enrollment._id,
        branchId
      );
      setOccurrences(occurrences || []);
    } catch (e) {
      setError(e?.message || "Error al cargar");
    } finally {
      setLoading(false);
    }
  }

  async function loadOptions(fromISO) {
    setError("");
    setOptions([]);
    setLoading(true);
    try {
      const { options } = await getRescheduleOptions({
        enrollmentId: enrollment._id,
        fromDateISO: fromISO,
        branchId,
      });
      setOptions(options || []);
    } catch (e) {
      setError(e?.message || "Error buscando opciones");
    } finally {
      setLoading(false);
    }
  }

  async function confirmMove(opt) {
    setSaving(true);
    setError("");
    try {
      await createOrUpdateReschedule({
        enrollmentId: enrollment._id,
        fromDateISO: selectedFrom,
        toDateISO: opt.to,
        slotTo: opt.slotTo,
        motivo: "Cambio desde editor",
        toProfessorId: opt.professorId,
        slotFrom: selectedSlot,
        branchId,
      });
      getEnrollmentOccurrences(enrollment._id, branchId)
        .then(({ occurrences }) => {
          setOccurrences(occurrences || []);
        })
        .catch((e) => {
          setError(e?.message || "Error al cargar");
        })
        .finally(() => setLoading(false));
      await reloadOccurrences();
      onDone?.();
    } catch (e) {
      setError(e?.message || "No se pudo reprogramar");
    } finally {
      setSaving(false);
    }
  }

  async function removeOccurrence(o) {
    // Solo permitido para adhoc (Attendance) y reschedule-in (StudentReschedule)
    if (!["adhoc", "reschedule-in"].includes(o.origin)) return;
    setSaving(true);
    setError("");
    const r = await Swal.fire({
      title: "Eliminar inscripción",
      text: "Se borrará esta inscripción y sus reprogramaciones asociadas. ¿Continuar?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
    });
    if (!r.isConfirmed) return;
    try {
      const payload =
        o.origin === "adhoc"
          ? { origin: "adhoc", attendanceId: o?.attendanceRef?._id }
          : { origin: "reschedule-in", rescheduleId: o?.rescheduleRef?._id };

      if (!payload.attendanceId && !payload.rescheduleId) {
        throw new Error("Falta el identificador de la clase a eliminar.");
      }

      const data = await removeOccurrenceApi({
        branchId,
        enrollmentId: enrollment._id,
        ...payload,
      });

      if (!data.ok) throw new Error(data?.error || "No se pudo eliminar");
      await Swal.fire({ title: "Eliminada", icon: "success" });
      await reloadOccurrences();
    } catch (e) {
      Swal.fire({ title: "Error", text: e.message, icon: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="space-y-4 rounded-2xl border p-4 sm:p-5"
      style={{ borderColor: "#DDD7C9" }}
    >
      <h4 className="font-semibold" style={{ color: "#1F1C19" }}>
        Reprogramar una clase
      </h4>

      {/* Loading spinner when fetching or saving */}
      {loading && (
        <div className="flex justify-center py-3">
          <ClipLoader color={BRAND.main} size={35} speedMultiplier={0.9} />
        </div>
      )}
      {error && (
        <p
          className="text-sm rounded-xl border px-3 py-2"
          style={{
            color: "#991B1B",
            backgroundColor: "#FEF2F2",
            borderColor: "#FECACA",
          }}
        >
          {error}
        </p>
      )}

      <div className="space-y-2">
        <div className="text-sm" style={{ color: "#1F1C19" }}>
          1) Elegí la clase a mover
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {occurrences.map((o, i) => (
            <div
              key={i}
              className={`px-3 py-2 rounded-2xl border text-left shadow-sm transition hover:shadow`}
              style={{
                background: selectedFrom === o.start ? "#A08775" : "#fff",
                borderColor: selectedFrom === o.start ? "#A08775" : "#DDD7C9",
                color: selectedFrom === o.start ? "#fff" : "#1F1C19",
              }}
            >
              <button
                onClick={() => {
                  setSelectedSlot(o.slot);
                  setSelectedFrom(o.start);
                  loadOptions(o.start);
                }}
                className="w-full text-left"
              >
                <div className="text-sm font-medium">
                  {format(addHours(parseISO(o.start), 3), "PPPP p", {
                    locale: es,
                  })}
                </div>
                <div
                  className="text-xs"
                  style={{
                    color: selectedFrom === o.start ? "#fff" : "#6B7280",
                  }}
                >
                  {o.slot &&
                    `${
                      ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"][
                        o.slot.dayOfWeek
                      ]
                    } ${String(Math.floor(o.slot.startMin / 60)).padStart(
                      2,
                      "0"
                    )}:${String(o.slot.startMin % 60).padStart(2, "0")}`}
                </div>
              </button>

              {["adhoc", "reschedule-in"].includes(o.origin) && (
                <div className="mt-2 flex justify-end">
                  <button
                    onClick={() => removeOccurrence(o)}
                    disabled={saving}
                    className="text-xs rounded-lg px-2 py-1 border"
                    style={{
                      borderColor: "#ef4444",
                      color: selectedFrom === o.start ? "#fff" : "#ef4444",
                      background:
                        selectedFrom === o.start ? "#ef4444" : "transparent",
                    }}
                    title={
                      o.origin === "adhoc"
                        ? "Eliminar clase ad-hoc"
                        : "Eliminar reprogramación"
                    }
                  >
                    Eliminar
                  </button>
                </div>
              )}
            </div>
          ))}
          {!loading && occurrences.length === 0 && (
            <div
              className="text-sm rounded-2xl border border-dashed p-3"
              style={{ color: "#6B7280", borderColor: "#DDD7C9" }}
            >
              Sin clases en el mes.
            </div>
          )}
        </div>
      </div>

      {selectedFrom && (
        <div className="space-y-2">
          <div className="text-sm" style={{ color: "#1F1C19" }}>
            2) Elegí un reemplazo dentro de 7 días
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {options.map((opt, i) => (
              <button
                key={i}
                disabled={opt.status !== "available" || saving}
                onClick={() => confirmMove(opt)}
                className={`px-3 py-2 rounded-2xl border text-left shadow-sm transition ${
                  opt.status !== "available"
                    ? "disabled:cursor-not-allowed disabled:opacity-60"
                    : "hover:shadow"
                }`}
                style={{
                  background: "#fff",
                  borderColor: "#DDD7C9",
                  opacity: opt.status !== "available" || saving ? 0.6 : 1,
                }}
              >
                <div className="text-sm font-medium">
                  {format(addHours(parseISO(opt.to), 3), "PPPP p", {
                    locale: es,
                  })}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
