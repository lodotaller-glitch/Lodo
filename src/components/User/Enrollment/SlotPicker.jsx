"use client";
import { useEffect, useMemo, useState } from "react";
import {
  getProfessorSlots,
  getProfessorSlotsForMonth,
} from "@/functions/request/enrollments";
import { useParams } from "next/navigation";

const DOW = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const BRAND = { main: "#A08775", soft: "#DDD7C9" };

function strMin(min) {
  const h = Math.floor(min / 60),
    m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export default function SlotPicker({
  professorId,
  year,
  month,
  value = [],
  onChange,
}) {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const {branchId} = useParams();

  useEffect(() => {
    if (!year || !month) return;
    let alive = true;
    setLoading(true);
    setError("");
    getProfessorSlots(year, month, branchId)
      .then(({ slots }) => {
        if (alive) setSlots(slots || []);
      })
      .catch((e) => {
        if (alive) {
          setError(e?.message || "Error");
          setSlots([]);
        }
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [professorId, year, month]);

  const selectedKeys = useMemo(
    () =>
      new Set(
        value.map(
          (k) =>
            `${k.professorId || professorId}-${k.dayOfWeek}-${k.startMin}-${
              k.endMin
            }`
        )
      ),
    [value]
  );

  function toggle(slot) {
    const key = `${slot.professorId}-${slot.dayOfWeek}-${slot.startMin}-${slot.endMin}`;
    const arr = [...value];
    const idx = arr.findIndex(
      (s) =>
        `${slot.professorId}-${s.dayOfWeek}-${s.startMin}-${s.endMin}` === key
    );
    if (idx >= 0) {
      arr.splice(idx, 1);
    } else {
      if (arr.length >= 2) return;
      arr.push(slot);
    }
    onChange?.(arr);
  }

return (
  <div className="space-y-3">
    {error && (
      <p
        className="text-sm rounded-xl border px-3 py-2"
        style={{ color: "#991B1B", backgroundColor: "#FEF2F2", borderColor: "#FECACA" }}
      >
        {error}
      </p>
    )}

    {loading && (
      <p
        className="text-sm rounded-xl border px-3 py-2"
        style={{ color: "#1F1C19", backgroundColor: "#DDD7C966", borderColor: "#DDD7C9" }}
      >
        Cargando horarios…
      </p>
    )}

    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {slots.map((s, i) => {
        const key = `${s.professorId}-${s.dayOfWeek}-${s.startMin}-${s.endMin}`;
        const active = selectedKeys.has(key);
        return (
          <button
            key={i}
            onClick={() => toggle(s)}
            className={`text-left px-3 py-2 rounded-2xl border shadow-sm transition hover:shadow ${
              active ? "text-white" : ""
            }`}
            style={{
              background: active ? BRAND.main : "#fff",
              borderColor: active ? BRAND.main : "#DDD7C9",
            }}
          >
            <div className="text-sm font-semibold">
              {s.professorName} - {DOW[s.dayOfWeek]} {strMin(s.startMin)}–{strMin(s.endMin)}
            </div>
            <div className={`text-xs ${active ? "opacity-90" : "opacity-70"}`}>
              Click para {active ? "quitar" : "elegir"}
            </div>
          </button>
        );
      })}

      {!loading && slots.length === 0 && (
        <div
          className="text-sm rounded-2xl border border-dashed p-3"
          style={{ color: "#6B7280", borderColor: "#DDD7C9" }}
        >
          Sin franjas configuradas para el mes pero deben ser del mismo profesor.
        </div>
      )}
    </div>

    <div className="text-xs" style={{ color: "#6B7280" }}>
      Podés elegir hasta 2 franjas.
    </div>
  </div>
);
}
