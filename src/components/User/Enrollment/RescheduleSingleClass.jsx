"use client";
import { useEffect, useState } from "react";
import {
  getEnrollmentOccurrences,
  getRescheduleOptions,
  createOrUpdateReschedule,
} from "@/functions/request/enrollments";
import { useParams } from "next/navigation";

export default function RescheduleSingleClass({ enrollment, onDone }) {
  const [occurrences, setOccurrences] = useState([]);
  const [selectedFrom, setSelectedFrom] = useState(null);
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { branchId } = useParams();

  useEffect(() => {
    if (!enrollment?._id) return;
    let alive = true;
    setLoading(true);
    setError("");
    getEnrollmentOccurrences(enrollment._id)
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
  }, [enrollment?._id]);

  async function loadOptions(fromISO) {
    setError("");
    setOptions([]);
    setLoading(true);
    try {
      const { options } = await getRescheduleOptions({
        enrollmentId: enrollment._id,
        fromDateISO: fromISO,
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
        branchId,
      });
      onDone?.();
    } catch (e) {
      setError(e?.message || "No se pudo reprogramar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <h4 className="font-medium">Reprogramar una clase</h4>

      {loading && <p className="text-sm text-gray-600">Cargando…</p>}
      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="space-y-2">
        <div className="text-sm text-gray-700">1) Elegí la clase a mover</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {occurrences.map((o, i) => (
            <button
              key={i}
              onClick={() => {
                setSelectedFrom(o.start);
                loadOptions(o.start);
              }}
              className={`px-3 py-2 rounded-xl border ${
                selectedFrom === o.start ? "bg-[#DDD7C9]" : "bg-white"
              }`}
            >
              <div className="text-sm">
                {new Date(o.start).toLocaleString()}
              </div>
              <div className="text-xs text-gray-600">
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
          ))}
          {!loading && occurrences.length === 0 && (
            <div className="text-sm text-gray-600">Sin clases en el mes.</div>
          )}
        </div>
      </div>

      {selectedFrom && (
        <div className="space-y-2">
          <div className="text-sm text-gray-700">
            2) Elegí un reemplazo dentro de 7 días
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {options.map((opt, i) => (
              <button
                key={i}
                disabled={opt.status !== "available" || saving}
                onClick={() => confirmMove(opt)}
                className={`px-3 py-2 rounded-xl border text-left ${
                  opt.status !== "available"
                    ? "opacity-50 cursor-not-allowed"
                    : ""
                }`}
              >
                <div className="text-sm font-medium">
                  {new Date(opt.to).toLocaleString()}
                </div>
                <div className="text-xs text-gray-600">
                  Cupos: {opt.capacityLeft} ({opt.status})
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
