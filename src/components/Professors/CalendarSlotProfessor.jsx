import { useEffect, useState } from "react";

const BRAND = { main: "#A08775", soft: "#DDD7C9", text: "#1F1C19" };

export default function CalendarSlotProfessor({ slots, onChange }) {
  const [localSlots, setLocalSlots] = useState(slots);

  useEffect(() => {
    setLocalSlots(slots);
  }, [slots]);

  function handleAddSlot() {
    setLocalSlots([...localSlots, { dayOfWeek: 0, startMin: 0, endMin: 60 }]);
  }

  function handleUpdateSlot(index, updatedSlot) {
    const newSlots = [...localSlots];
    newSlots[index] = updatedSlot;
    setLocalSlots(newSlots);
    onChange(newSlots);
  }

  function handleRemoveSlot(index) {
    const newSlots = localSlots.filter((_, i) => i !== index);
    setLocalSlots(newSlots);
    onChange(newSlots);
  }

  return (
    <div className="space-y-3">
      {localSlots.map((slot, index) => (
        <div
          key={index}
          className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr,1fr,1fr,auto] items-end rounded-2xl border p-3"
          style={{ borderColor: BRAND.soft, background: "#fff" }}
        >
          <label className="flex flex-col">
            <span
              className="mb-1 text-xs font-medium"
              style={{ color: `${BRAND.text}CC` }}
            >
              Día
            </span>
            <select
              value={slot.dayOfWeek}
              onChange={(e) =>
                handleUpdateSlot(index, {
                  ...slot,
                  dayOfWeek: Number(e.target.value),
                })
              }
              className="rounded-xl border bg-white/90 px-3 py-2 shadow-sm outline-none transition focus:ring-2"
              style={{ borderColor: BRAND.soft, color: BRAND.text }}
            >
              {[
                "Domingo",
                "Lunes",
                "Martes",
                "Miércoles",
                "Jueves",
                "Viernes",
                "Sábado",
              ].map((day, i) => (
                <option key={i} value={i}>
                  {day}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col">
            <span
              className="mb-1 text-xs font-medium"
              style={{ color: `${BRAND.text}CC` }}
            >
              Inicio
            </span>
            <input
              type="time"
              value={convertMinutesToTime(slot.startMin)}
              onChange={(e) =>
                handleUpdateSlot(index, {
                  ...slot,
                  startMin: convertTimeToMinutes(e.target.value),
                })
              }
              className="rounded-xl border bg-white/90 px-3 py-2 shadow-sm outline-none transition focus:ring-2"
              style={{ borderColor: BRAND.soft, color: BRAND.text }}
            />
          </label>

          <label className="flex flex-col">
            <span
              className="mb-1 text-xs font-medium"
              style={{ color: `${BRAND.text}CC` }}
            >
              Fin
            </span>
            <input
              type="time"
              value={convertMinutesToTime(slot.endMin)}
              onChange={(e) =>
                handleUpdateSlot(index, {
                  ...slot,
                  endMin: convertTimeToMinutes(e.target.value),
                })
              }
              className="rounded-xl border bg-white/90 px-3 py-2 shadow-sm outline-none transition focus:ring-2"
              style={{ borderColor: BRAND.soft, color: BRAND.text }}
            />
          </label>

          <button
            onClick={() => handleRemoveSlot(index)}
            className="h-[42px] rounded-xl border px-3 text-sm font-medium transition hover:bg-red-50"
            style={{
              borderColor: "#FCA5A5",
              color: "#991B1B",
              background: "#fff",
            }}
            title="Eliminar franja"
          >
            Eliminar
          </button>
        </div>
      ))}

      <button
        onClick={handleAddSlot}
        className="rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition hover:brightness-95"
        style={{ background: BRAND.main, color: "#fff" }}
      >
        + Agregar franja
      </button>
    </div>
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
