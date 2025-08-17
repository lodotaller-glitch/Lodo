"use client";
const DOW = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
function minutesToDateUTC(y, m, dom, minutes) {
  const d = new Date(Date.UTC(y, m - 1, dom, 0, 0, 0, 0));
  d.setUTCMinutes(minutes);
  return d;
}
function strMin(min) {
  const h = Math.floor(min / 60),
    mm = min % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
export function OccurrencePicker({ enrollment, onPick }) {
  if (!enrollment)
    return <p className="text-sm text-gray-500">No hay inscripción activa.</p>;
  const {
    year,
    month,
    chosenSlots = enrollment.chosenSlots || enrollment.slotsElegidos || [],
  } = enrollment;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const occs = [];
  for (let dom = 1; dom <= daysInMonth; dom++) {
    const d = new Date(Date.UTC(year, month - 1, dom));
    const dow = d.getUTCDay();
    for (const s of chosenSlots) {
      if (s.dayOfWeek === dow) {
        occs.push({
          date: minutesToDateUTC(year, month, dom, s.startMin),
          dayOfWeek: s.dayOfWeek,
          startMin: s.startMin,
          endMin: s.endMin,
        });
      }
    }
  }
  occs.sort((a, b) => a.date - b.date);
  if (!occs.length)
    return <p className="text-sm text-gray-500">No hay clases este mes.</p>;
  return (
    <div className="space-y-2">
      <div className="text-sm text-gray-600">
        Elegí la clase que querés reprogramar:
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {occs.map((o, i) => (
          <button
            key={`${o.date.toISOString()}-${i}`}
            onClick={() => onPick?.(o)}
            className="text-left px-3 py-2 rounded-xl border bg-white hover:bg-gray-50"
          >
            <div className="text-sm font-medium">
              {o.date.toLocaleDateString()} · {DOW[o.dayOfWeek]}
            </div>
            <div className="text-xs text-gray-600">
              {strMin(o.startMin)}–{strMin(o.endMin)}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
