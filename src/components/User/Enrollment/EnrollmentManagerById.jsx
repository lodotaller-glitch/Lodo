"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import ManageEnrollmentActions from "./ManageEnrollmentActions";
import api from "@/lib/axios";
import Swal from "sweetalert2";
import { NewEnrollmentInline } from "./NewEnrollmentInline";

const BRAND = { main: "#A08775", soft: "#DDD7C9", text: "#1F1C19" };

const PAY_STATES = ["pendiente", "señado", "pagado", "cancelado"];
const PAY_METHODS = ["transferencia", "efectivo", "otro", "no_aplica"];

function strMin(min) {
  const h = Math.floor(min / 60);
  const mm = min % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
const DOW = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function Notice({ kind = "info", children }) {
  const styles = {
    success: { fg: "#166534", bg: "#ECFDF5", br: "#86EFAC" },
    error: { fg: "#991B1B", bg: "#FEF2F2", br: "#FECACA" },
    info: { fg: BRAND.text, bg: `${BRAND.soft}66`, br: BRAND.soft },
  }[kind];
  return (
    <div
      role="status"
      className="rounded-xl border px-3 py-2 text-sm"
      style={{
        color: styles.fg,
        backgroundColor: styles.bg,
        borderColor: styles.br,
      }}
    >
      {children}
    </div>
  );
}

function StateBadge({ assigned }) {
  return (
    <span
      className="rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{
        backgroundColor: assigned ? "#ECFDF5" : `${BRAND.soft}`,
        border: `1px solid ${assigned ? "#86EFAC" : `${BRAND.main}55`}`,
        color: assigned ? "#166534" : BRAND.text,
      }}
    >
      {assigned ? "Asignado" : "Sin asignar"}
    </span>
  );
}

function PayPreview({ pay }) {
  const st = String(pay?.state || "pendiente").toLowerCase();
  const map = {
    pendiente: { bg: `${BRAND.soft}`, br: `${BRAND.main}55`, tx: BRAND.text },
    señado: { bg: `${BRAND.soft}AA`, br: `${BRAND.main}77`, tx: BRAND.text },
    pagado: { bg: "#ECFDF5", br: "#86EFAC", tx: "#166534" },
    cancelado: { bg: "#FEF2F2", br: "#FECACA", tx: "#991B1B" },
  }[st] || { bg: `${BRAND.soft}`, br: `${BRAND.main}55`, tx: BRAND.text };
  return (
    <span
      className="rounded-full px-2.5 py-0.5 text-xs"
      style={{
        backgroundColor: map.bg,
        border: `1px solid ${map.br}`,
        color: map.tx,
      }}
    >
      {st}
    </span>
  );
}

export default function EnrollmentManagerById({
  studentId: propStudentId,
  title = "Inscripciones del alumno",
  branchId: branchIdProp,
}) {
  const params = useParams();
  const studentId = propStudentId ?? params?.id;
  const branchId = branchIdProp || params?.branchId;

  const [items, setItems] = useState([]); // enrollments
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // edición local de pago por enrollment
  const [draftPay, setDraftPay] = useState({}); // { [enrollmentId]: { state, method, amount, reference, observations } }
  const [savingPay, setSavingPay] = useState({});

  const canLoad = useMemo(
    () => Boolean(studentId && String(studentId).length > 0 && branchId),
    [studentId, branchId]
  );

  async function load() {
    if (!canLoad) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/${branchId}/enrollments/by-student/${studentId}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No se pudo cargar");
      const arr = data.enrollments || [];
      setItems(arr);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, branchId]);

  async function toggleAssign(enrollmentId, assigned) {
    const endpoint = assigned
      ? `/api/${branchId}/enrollments/unassign`
      : `/api/${branchId}/enrollments/assigned`;
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
      const res = await fetch(`/api/${branchId}/enrollments/pay`, {
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

  async function deleteEnrollment(enrollmentId) {
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
      const { data } = await api.delete(
        `/${branchId}/enrollments/${enrollmentId}`
      );

      if (!data.ok) throw new Error(data?.error || "No se pudo eliminar");
      await Swal.fire({ title: "Eliminada", icon: "success" });
      await load();
    } catch (e) {
      Swal.fire({ title: "Error", text: e.message, icon: "error" });
    }
  }

  return (
    <section
      className="space-y-4 rounded-2xl border p-5 shadow-2xl sm:p-6"
      style={{ borderColor: BRAND.soft }}
    >
      {/* Header */}
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-semibold" style={{ color: BRAND.text }}>
          {title}
        </h2>
      </header>

      {/* Notices */}
      {loading && <Notice> Cargando… </Notice>}
      {error && <Notice kind="error">{error}</Notice>}

      <div className="space-y-3">
        <NewEnrollmentInline
          branchId={branchId}
          studentId={studentId}
          onCreated={load}
        />

        {items.map((e) => {
          const draft = draftPay[e._id] || {};
          return (
            <div
              key={e._id}
              className="rounded-2xl border-2 shadow-2xl p-4 sm:p-5 "
              style={{ borderColor: BRAND.main }}
            >
              {/* Top row */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 text-sm" style={{ color: BRAND.text }}>
                  <div className="truncate text-base font-semibold">
                    {e.professor?.name || e.professor}
                  </div>
                  <div
                    className="mt-0.5 text-xs"
                    style={{ color: `${BRAND.text}99` }}
                  >
                    {e.year}-{String(e.month).padStart(2, "0")} —{" "}
                    {e.chosenSlots.map(
                      (s, i) =>
                        `${i ? ", " : ""}${DOW[s.dayOfWeek]} ${strMin(
                          s.startMin
                        )}–${strMin(s.endMin)}`
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => deleteEnrollment(e._id)}
                    className="rounded-xl px-3 py-1.5 text-sm font-medium shadow-sm transition hover:shadow"
                    style={{
                      backgroundColor: "#ef4444",
                      color: "#fff",
                      border: `1px solid #ef4444`,
                    }}
                    title="Eliminar inscripción"
                  >
                    Eliminar
                  </button>
                  <PayPreview pay={e.pay} />
                  <StateBadge assigned={!!e.assigned} />
                  <button
                    onClick={() => toggleAssign(e._id, e.assigned)}
                    className="rounded-xl px-3 py-1.5 text-sm font-medium shadow-sm transition hover:shadow"
                    style={{
                      backgroundColor: e.assigned
                        ? `${BRAND.soft}55`
                        : BRAND.main,
                      color: e.assigned ? BRAND.text : "#fff",
                      border: `1px solid ${BRAND.main}`,
                    }}
                  >
                    {e.assigned ? "Desasignar" : "Asignar"}
                  </button>
                </div>
              </div>

              {/* Actions (externas) */}
              <div className="mt-3">
                <ManageEnrollmentActions enrollment={e} onChanged={load} />
              </div>

              {/* Pago */}
              <div className="mt-4 grid grid-cols-1 items-end gap-3 md:grid-cols-5">
                <label className="flex flex-col">
                  <span
                    className="mb-1 text-xs"
                    style={{ color: `${BRAND.text}99` }}
                  >
                    Estado de pago
                  </span>
                  <select
                    className="w-full rounded-xl border bg-white/90 px-3 py-2 text-sm shadow-sm outline-none transition focus:ring-2"
                    style={{ borderColor: BRAND.soft, color: BRAND.text }}
                    value={draft.state || "pendiente"}
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
                  <span
                    className="mb-1 text-xs"
                    style={{ color: `${BRAND.text}99` }}
                  >
                    Método
                  </span>
                  <select
                    className="w-full rounded-xl border bg-white/90 px-3 py-2 text-sm shadow-sm outline-none transition focus:ring-2"
                    style={{ borderColor: BRAND.soft, color: BRAND.text }}
                    value={draft.method || "no_aplica"}
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
                  <span
                    className="mb-1 text-xs"
                    style={{ color: `${BRAND.text}99` }}
                  >
                    Monto
                  </span>
                  <input
                    type="number"
                    className="w-full rounded-xl border bg-white/90 px-3 py-2 text-sm shadow-sm outline-none transition focus:ring-2"
                    style={{ borderColor: BRAND.soft, color: BRAND.text }}
                    value={draft.amount ?? ""}
                    onChange={(ev) =>
                      setDraftPay((p) => ({
                        ...p,
                        [e._id]: {
                          ...p[e._id],
                          amount:
                            ev.target.value === ""
                              ? ""
                              : Number(ev.target.value),
                        },
                      }))
                    }
                  />
                </label>

                <label className="flex flex-col">
                  <span
                    className="mb-1 text-xs"
                    style={{ color: `${BRAND.text}99` }}
                  >
                    Referencia
                  </span>
                  <input
                    className="w-full rounded-xl border bg-white/90 px-3 py-2 text-sm shadow-sm outline-none transition focus:ring-2"
                    style={{ borderColor: BRAND.soft, color: BRAND.text }}
                    value={draft.reference || ""}
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
                    className="w-full rounded-xl px-4 py-2 text-sm font-medium shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60"
                    style={{ backgroundColor: BRAND.main, color: "#fff" }}
                  >
                    {savingPay[e._id] ? "Guardando…" : "Guardar pago"}
                  </button>
                </div>
              </div>

              <div className="mt-3">
                <label className="flex flex-col">
                  <span
                    className="mb-1 text-xs"
                    style={{ color: `${BRAND.text}99` }}
                  >
                    Observaciones
                  </span>
                  <textarea
                    className="w-full rounded-xl border bg-white/90 px-3 py-2 text-sm shadow-sm outline-none transition focus:ring-2"
                    rows={2}
                    style={{ borderColor: BRAND.soft, color: BRAND.text }}
                    value={draft.observations || ""}
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
          );
        })}

        {!items.length && !loading && (
          <p className="text-sm" style={{ color: `${BRAND.text}99` }}>
            Sin inscripciones para mostrar.
          </p>
        )}
      </div>
    </section>
  );
}
