import { useState } from "react";

export default function CalendarSlotProfessor({ slots, onChange }) {
  const [localSlots, setLocalSlots] = useState(slots);

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
    <div className="space-y-4">
      {localSlots.map((slot, index) => (
        <div key={index} className="flex items-center gap-4">
          <select
            value={slot.dayOfWeek}
            onChange={(e) =>
              handleUpdateSlot(index, { ...slot, dayOfWeek: Number(e.target.value) })
            }
            className="border rounded-lg px-3 py-2"
          >
            {["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"].map(
              (day, i) => (
                <option key={i} value={i}>
                  {day}
                </option>
              )
            )}
          </select>
          <input
            type="time"
            value={convertMinutesToTime(slot.startMin)}
            onChange={(e) =>
              handleUpdateSlot(index, {
                ...slot,
                startMin: convertTimeToMinutes(e.target.value),
              })
            }
            className="border rounded-lg px-3 py-2"
          />
          <input
            type="time"
            value={convertMinutesToTime(slot.endMin)}
            onChange={(e) =>
              handleUpdateSlot(index, {
                ...slot,
                endMin: convertTimeToMinutes(e.target.value),
              })
            }
            className="border rounded-lg px-3 py-2"
          />
          <button
            onClick={() => handleRemoveSlot(index)}
            className="px-3 py-2 bg-red-500 text-white rounded-lg"
          >
            Eliminar
          </button>
        </div>
      ))}
      <button
        onClick={handleAddSlot}
        className="px-4 py-2 bg-blue-500 text-white rounded-lg"
      >
        + Agregar franja
      </button>
    </div>
  );
}

function convertMinutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

function convertTimeToMinutes(time) {
  const [hours, mins] = time.split(":").map(Number);
  return hours * 60 + mins;
}