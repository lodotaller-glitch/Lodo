"use client";
import { useEffect, useMemo, useState } from "react";
import {
  getProfessorSlots,
  getProfessorSlotsForMonth,
} from "@/functions/request/enrollments";

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

  useEffect(() => {
    if (!year || !month) return;
    let alive = true;
    setLoading(true);
    setError("");
    getProfessorSlots( year, month)
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
    () => new Set(value.map((k) => `${k.dayOfWeek}-${k.startMin}-${k.endMin}`)),
    [value]
  );

  function toggle(slot) {
    const key = `${slot.dayOfWeek}-${slot.startMin}-${slot.endMin}`;
    const arr = [...value];
    const idx = arr.findIndex(
      (s) => `${s.dayOfWeek}-${s.startMin}-${s.endMin}` === key
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
    <div className="space-y-2">
      {error && <p className="text-sm text-red-700">{error}</p>}
      {loading && <p className="text-sm text-gray-600">Cargando horarios…</p>}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {slots.map((s, i) => {
          const key = `${s.dayOfWeek}-${s.startMin}-${s.endMin}`;
          const active = selectedKeys.has(key);
          return (
            <button
              key={i}
              onClick={() => toggle(s)}
              className={`text-left px-3 py-2 rounded-xl border ${
                active ? "text-white" : ""
              }`}
              style={{
                background: active ? BRAND.main : "white",
                borderColor: active ? BRAND.main : "#e5e7eb",
              }}
            >
              <div className="text-sm font-medium">
                {DOW[s.dayOfWeek]} {strMin(s.startMin)}–{strMin(s.endMin)}
              </div>
              <div className="text-xs opacity-80">
                Click para {active ? "quitar" : "elegir"}
              </div>
            </button>
          );
        })}
        {!loading && slots.length === 0 && (
          <div className="text-sm text-gray-600">
            Sin franjas configuradas para el mes.
          </div>
        )}
      </div>
      <div className="text-xs text-gray-600">Podés elegir hasta 2 franjas.</div>
    </div>
  );
}
