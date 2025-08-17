"use client";
export function ScopeSwitcher({
  value,
  onChange,
  disabledNext = false,
  disabledSingle = false,
}) {
  const btn = (v, text, disabled = false) => (
    <button
      onClick={() => !disabled && onChange(v)}
      disabled={disabled}
      className={`px-3 py-1.5 rounded-xl border disabled:opacity-60 ${
        value === v ? "bg-white" : ""
      }`}
    >
      {text}
    </button>
  );
  return (
    <div className="flex gap-2">
      {btn("current", "Este mes")}
      {btn("next", "Mes siguiente", disabledNext)}
      {btn("single", "Una sola clase", disabledSingle)}
    </div>
  );
}
