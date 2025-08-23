"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import ManageEnrollmentActions from "./ManageEnrollmentActions";

const PAY_STATES = ["pendiente", "señado", "pagado", "cancelado"];
const PAY_METHODS = ["transferencia", "efectivo", "otro", "no_aplica"];

function strMin(min) {
  const h = Math.floor(min / 60);
  const mm = min % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export default function EnrollmentManagerById({
  studentId: propStudentId,
  title = "Inscripciones del alumno",
}) {
  const params = useParams();
  const studentId = propStudentId ?? params?.id;

  const [items, setItems] = useState([]); // enrollments
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // edición local de pago por enrollment
  const [draftPay, setDraftPay] = useState({}); // { [enrollmentId]: { state, method, amount, reference, observations } }
  const [savingPay, setSavingPay] = useState({});

  const canLoad = useMemo(
    () => Boolean(studentId && String(studentId).length > 0),
    [studentId]
  );

  async function load() {
    if (!canLoad) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/enrollments/by-student/${studentId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No se pudo cargar");
      const arr = data.enrollments || [];
      setItems(arr);
      // preparar drafts de pago
      const init = {};
      for (const e of arr) {
        init[e._id] = {
          state: e?.pay?.state || "pendiente",
          method: e?.pay?.method || "no_aplica",
          amount: e?.pay?.amount ?? "",
          reference: e?.pay?.reference || "",
          observations: e?.pay?.observations || "",
        };
      }
      setDraftPay(init);
    } catch (e) {
      setItems([]);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [studentId]);

  async function toggleAssign(enrollmentId, assigned) {
    const endpoint = assigned
      ? "/api/enrollments/unassign"
      : "/api/enrollments/assigned";
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enrollmentId }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data?.error || "Error");
      return;
    }
    await load();
  }

  async function savePay(enrollmentId) {
    const draft = draftPay[enrollmentId];
    if (!draft) return;
    setSavingPay((s) => ({ ...s, [enrollmentId]: true }));
    try {
      const res = await fetch("/api/enrollments/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrollmentId, ...draft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No se pudo guardar el pago");
      await load();
    } catch (e) {
      alert(e.message);
    } finally {
      setSavingPay((s) => ({ ...s, [enrollmentId]: false }));
    }
  }

  console.log(items, "items");
  

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="text-sm text-gray-500">
          Alumno ID: {String(studentId || "—")}
        </div>
      </header>

      {loading && (
        <div className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-3">
          Cargando…
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="space-y-3">
        {items.map((e) => (
          <div key={e._id} className="border rounded-xl p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <div>
                  <span className="font-medium">
                    {e.professor?.name || e.professor}
                  </span>
                </div>
                <div>
                  {e.year}-{String(e.month).padStart(2, "0")} —{" "}
                  {e.chosenSlots.map(
                    (s, i) =>
                      `${i ? ", " : ""}${
                        ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"][
                          s.dayOfWeek
                        ]
                      } ${strMin(s.startMin)}–${strMin(s.endMin)}`
                  )}
                </div>
                <div>
                  Asignado:{" "}
                  <span
                    className={`font-semibold ${
                      e.assigned ? "text-green-700" : "text-gray-500"
                    }`}
                  >
                    {e.assigned ? "Sí" : "No"}
                  </span>
                </div>
              </div>
              <button
                onClick={() => toggleAssign(e._id, e.assigned)}
                className={`px-4 py-2 rounded-xl ${
                  e.assigned ? "bg-white border" : "bg-black text-white"
                }`}
              >
                {e.assigned ? "Desasignar" : "Asignar"}
              </button>
            </div>
            <ManageEnrollmentActions enrollment={e} onChanged={load} />
            {/* Editor de pago */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
              <label className="flex flex-col">
                <span className="text-xs text-gray-600 mb-1">
                  Estado de pago
                </span>
                <select
                  className="border rounded-lg px-3 py-2"
                  value={draftPay[e._id]?.state || "pendiente"}
                  onChange={(ev) =>
                    setDraftPay((p) => ({
                      ...p,
                      [e._id]: { ...p[e._id], state: ev.target.value },
                    }))
                  }
                >
                  {PAY_STATES.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col">
                <span className="text-xs text-gray-600 mb-1">Método</span>
                <select
                  className="border rounded-lg px-3 py-2"
                  value={draftPay[e._id]?.method || "no_aplica"}
                  onChange={(ev) =>
                    setDraftPay((p) => ({
                      ...p,
                      [e._id]: { ...p[e._id], method: ev.target.value },
                    }))
                  }
                >
                  {PAY_METHODS.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col">
                <span className="text-xs text-gray-600 mb-1">Monto</span>
                <input
                  type="number"
                  className="border rounded-lg px-3 py-2"
                  value={draftPay[e._id]?.amount ?? ""}
                  onChange={(ev) =>
                    setDraftPay((p) => ({
                      ...p,
                      [e._id]: {
                        ...p[e._id],
                        amount:
                          ev.target.value === "" ? "" : Number(ev.target.value),
                      },
                    }))
                  }
                />
              </label>

              <label className="flex flex-col">
                <span className="text-xs text-gray-600 mb-1">Referencia</span>
                <input
                  className="border rounded-lg px-3 py-2"
                  value={draftPay[e._id]?.reference || ""}
                  onChange={(ev) =>
                    setDraftPay((p) => ({
                      ...p,
                      [e._id]: { ...p[e._id], reference: ev.target.value },
                    }))
                  }
                />
              </label>

              <div className="flex gap-2">
                <button
                  onClick={() => savePay(e._id)}
                  disabled={!!savingPay[e._id]}
                  className={`px-4 py-2 rounded-xl ${
                    savingPay[e._id]
                      ? "opacity-60 cursor-not-allowed"
                      : "bg-black text-white"
                  }`}
                >
                  {savingPay[e._id] ? "Guardando…" : "Guardar pago"}
                </button>
              </div>
            </div>

            <div>
              <label className="flex flex-col">
                <span className="text-xs text-gray-600 mb-1">
                  Observaciones
                </span>
                <textarea
                  className="border rounded-lg px-3 py-2"
                  rows={2}
                  value={draftPay[e._id]?.observations || ""}
                  onChange={(ev) =>
                    setDraftPay((p) => ({
                      ...p,
                      [e._id]: { ...p[e._id], observations: ev.target.value },
                    }))
                  }
                />
              </label>
            </div>
          </div>
        ))}

        {!items.length && !loading && (
          <p className="text-sm text-gray-500">
            Sin inscripciones para mostrar.
          </p>
        )}
      </div>
    </section>
  );
}
