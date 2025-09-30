const BRAND = { main: "#A08775", soft: "#DDD7C9", text: "#1F1C19" };

const PAY_STATES = ["pendiente", "señado", "pagado", "cancelado"];
const PAY_METHODS = ["transferencia", "efectivo", "otro", "no_aplica"];

export function PaymentFields({
  e,
  which = "pay",
  label = "Pago",
  draftPay,
  setDraftPay,
  isAdmin,
  savingPay,
  savePay,
}) {
  const draft = draftPay[e._id]?.[which] || {};
  const locked = !!draft.locked;
  const disabled = locked && !isAdmin;

  const setDraft = (patch) =>
    setDraftPay((p) => ({
      ...p,
      [e._id]: {
        ...p[e._id],
        [which]: { ...p[e._id]?.[which], ...patch },
      },
    }));

  return (
    <div
      className="mt-4 rounded-xl border p-3"
      style={{ borderColor: BRAND.soft }}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium" style={{ color: BRAND.text }}>
          {label}
        </span>
        {locked && (
          <span
            className="rounded-full px-2 py-0.5 text-xs"
            style={{
              background: "#fef3c7",
              border: "1px solid #f59e0b",
              color: "#92400e",
            }}
            title="Este pago está bloqueado. Solo admin puede editar."
          >
            Bloqueado
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-5">
        <label className="flex flex-col">
          <span className="mb-1 text-xs" style={{ color: `${BRAND.text}99` }}>
            Estado
          </span>
          <select
            disabled={disabled}
            className="w-full rounded-xl border bg-white/90 px-3 py-2 text-sm shadow-sm outline-none"
            style={{ borderColor: BRAND.soft, color: BRAND.text }}
            value={draft.state || "pendiente"}
            onChange={(ev) => setDraft({ state: ev.target.value })}
          >
            {PAY_STATES.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col">
          <span className="mb-1 text-xs" style={{ color: `${BRAND.text}99` }}>
            Método
          </span>
          <select
            disabled={disabled}
            className="w-full rounded-xl border bg-white/90 px-3 py-2 text-sm shadow-sm outline-none"
            style={{ borderColor: BRAND.soft, color: BRAND.text }}
            value={draft.method || "no_aplica"}
            onChange={(ev) => setDraft({ method: ev.target.value })}
          >
            {PAY_METHODS.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col">
          <span className="mb-1 text-xs" style={{ color: `${BRAND.text}99` }}>
            Monto
          </span>
          <input
            type="number"
            disabled={disabled}
            className="w-full rounded-xl border bg-white/90 px-3 py-2 text-sm shadow-sm outline-none"
            style={{ borderColor: BRAND.soft, color: BRAND.text }}
            value={draft.amount ?? ""}
            onChange={(ev) =>
              setDraft({
                amount: ev.target.value === "" ? "" : Number(ev.target.value),
              })
            }
          />
        </label>

        <label className="flex flex-col">
          <span className="mb-1 text-xs" style={{ color: `${BRAND.text}99` }}>
            Referencia
          </span>
          <input
            disabled={disabled}
            className="w-full rounded-xl border bg-white/90 px-3 py-2 text-sm shadow-sm outline-none"
            style={{ borderColor: BRAND.soft, color: BRAND.text }}
            value={draft.reference || ""}
            onChange={(ev) => setDraft({ reference: ev.target.value })}
          />
        </label>

        <div className="flex gap-2">
          <button
            onClick={() => savePay(e._id, which)}
            disabled={!!savingPay[e._id] || disabled}
            className="w-full rounded-xl px-4 py-2 text-sm font-medium shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60"
            style={{ backgroundColor: BRAND.main, color: "#fff" }}
          >
            {savingPay[which] ? "Guardando…" : "Guardar y sellar"}
          </button>
        </div>
      </div>

      <div className="mt-3">
        <label className="flex flex-col">
          <span className="mb-1 text-xs" style={{ color: `${BRAND.text}99` }}>
            Observaciones
          </span>
          <textarea
            disabled={disabled}
            className="w-full rounded-xl border bg-white/90 px-3 py-2 text-sm shadow-sm outline-none"
            rows={2}
            style={{ borderColor: BRAND.soft, color: BRAND.text }}
            value={draft.observations || ""}
            onChange={(ev) => setDraft({ observations: ev.target.value })}
          />
        </label>
      </div>
    </div>
  );
}
