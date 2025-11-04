// app/admin/payments/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

const BRAND = { main: "#A08775", soft: "#DDD7C9", text: "#1F1C19" };

function ymNow() {
  const d = new Date();
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

export default function PaymentsDashboardPage() {
  const { user } = useAuth();
  const { branchId } = useParams() || "";
  const route = useRouter();

  const { year: y0, month: m0 } = ymNow();
  const [year, setYear] = useState(y0);
  const [month, setMonth] = useState(m0);
  const [assigned, setAssigned] = useState(true);
  const [professorId, setProfessorId] = useState("");
  const [method, setMethod] = useState("");
  const [payState, setPayState] = useState("");
  const [onlyPaid, setOnlyPaid] = useState(false);

  const [loading, setLoading] = useState(false);
  const [profs, setProfs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [list, setList] = useState({ items: [], totalAmount: 0 });

  // cargar profesores por branch
  useEffect(() => {
    let ignore = false;
    async function loadProfs() {
      try {
        const q = new URLSearchParams();
        if (branchId) q.set("branchId", branchId);
        const res = await fetch(`/api/professors?${q.toString()}`);
        const js = await res.json();
        if (!ignore) setProfs(js.professors || []);
      } catch {}
    }
    loadProfs();
    return () => {
      ignore = true;
    };
  }, [branchId]);

  useEffect(() => {
    if (user && user?.role !== "admin") {
      route.push(`/${branchId}`);
    }
  }, [user]);

  const query = useMemo(() => {
    const qp = new URLSearchParams();
    qp.set("year", String(year));
    qp.set("month", String(month));
    qp.set("assigned", assigned);
    if (branchId) qp.set("branchId", branchId);
    if (professorId) qp.set("professorId", professorId);
    if (method) qp.set("method", method);
    if (payState) qp.set("payState", payState);
    return qp;
  }, [year, month, branchId, professorId, method, payState, assigned]);

  async function reload() {
    setLoading(true);
    try {
      // summary
      const qs1 = new URLSearchParams(query);
      qs1.set("onlyPaid", String(onlyPaid));
      const sres = await fetch(`/api/payments/summary?${qs1.toString()}`);
      const sjs = await sres.json();

      // list
      const lres = await fetch(`/api/payments/list?${query.toString()}`);
      const ljs = await lres.json();

      setSummary(sjs);
      setList(ljs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.toString(), onlyPaid]);

  const byMethod = summary?.byMethod || {};
  const byState = summary?.byState || {};
  const byProfessor = summary?.byProfessor || [];

  return (
    <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      <div
        className="rounded-2xl border px-4 py-3 sm:px-6"
        style={{
          borderColor: BRAND.soft,
          background: `linear-gradient(180deg, ${BRAND.soft}55, transparent)`,
        }}
      >
        <h1 className="text-2xl font-semibold" style={{ color: BRAND.text }}>
          Pagos del mes
        </h1>
      </div>

      {/* Filtros */}
      <section
        className="rounded-2xl border p-4 sm:p-6"
        style={{ borderColor: BRAND.soft }}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label
              className="block text-sm mb-1 font-medium"
              style={{ color: `${BRAND.text}CC` }}
            >
              Año
            </label>
            <input
              type="number"
              min="2000"
              max="3000"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full rounded-xl border bg-white/90 px-3 py-2 shadow-sm outline-none transition focus:ring-2"
              style={{ borderColor: BRAND.soft, color: BRAND.text }}
            />
          </div>

          <div>
            <label
              className="block text-sm mb-1 font-medium"
              style={{ color: `${BRAND.text}CC` }}
            >
              Mes
            </label>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="w-full rounded-xl border bg-white/90 px-3 py-2 shadow-sm outline-none transition focus:ring-2"
              style={{ borderColor: BRAND.soft, color: BRAND.text }}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              className="block text-sm mb-1 font-medium"
              style={{ color: `${BRAND.text}CC` }}
            >
              Asignado
            </label>
            <select
              value={assigned}
              onChange={(e) => setAssigned(e.target.value)}
              className="w-full rounded-xl border bg-white/90 px-3 py-2 shadow-sm outline-none transition focus:ring-2"
              style={{ borderColor: BRAND.soft, color: BRAND.text }}
            >
              <option value="">Todos</option>
              <option value={true}>Sí</option>
              <option value={false}>No</option>
            </select>
          </div>

          {/* <div className="md:col-span-2">
            <label
              className="block text-sm mb-1 font-medium"
              style={{ color: `${BRAND.text}CC` }}
            >
              Profesor
            </label>
            <select
              value={professorId}
              onChange={(e) => setProfessorId(e.target.value)}
              className="w-full rounded-xl border bg-white/90 px-3 py-2 shadow-sm outline-none transition focus:ring-2"
              style={{ borderColor: BRAND.soft, color: BRAND.text }}
            >
              <option value="">Todos</option>
              {profs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div> */}

          <div className="flex flex-col">
            <span>Pagado</span>
            <label
              className="inline-flex items-center text-sm rounded-xl border px-3 py-3 shadow-sm"
              style={{
                color: BRAND.text,
                borderColor: BRAND.soft,
                background: "#fff",
              }}
            >
              <input
                type="checkbox"
                checked={onlyPaid}
                onChange={(e) => setOnlyPaid(e.target.checked)}
                className="h-4 w-4"
                style={{ accentColor: BRAND.main }}
              />
            </label>
          </div>
        </div>
      </section>

      {/* Cards resumen */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {["transferencia", "efectivo", "otro", "no_aplica"].map((m) => (
          <div
            key={m}
            className="rounded-2xl border p-4 shadow-sm"
            style={{
              borderColor: BRAND.soft,
              background: "#fff",
              color: BRAND.text,
            }}
          >
            <div className="text-sm" style={{ color: `${BRAND.text}99` }}>
              Total {m}
            </div>
            <div className="text-2xl font-semibold">
              ARS {Number(byMethod[m]?.amount || 0).toLocaleString("es-AR")}
            </div>
            <div className="text-xs" style={{ color: `${BRAND.text}99` }}>
              {byMethod[m]?.count || 0} pagos
            </div>
          </div>
        ))}
      </section>

      {/* Estados */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          ["pendiente", "Pendiente"],
          ["señado", "Señado"],
          ["pagado", "Pagado"],
          ["cancelado", "Cancelado"],
        ].map(([k, label]) => (
          <div
            key={k}
            className="rounded-2xl border p-4"
            style={{
              borderColor: BRAND.soft,
              background:
                k === "pagado"
                  ? "#ECFDF5"
                  : k === "cancelado"
                  ? "#FEF2F2"
                  : "#fff",
            }}
          >
            <div className="text-sm" style={{ color: `${BRAND.text}99` }}>
              {label}
            </div>
            <div
              className="text-xl font-semibold"
              style={{ color: BRAND.text }}
            >
              {byState[k]?.count || 0} inscripciones
            </div>
            <div className="text-xs" style={{ color: `${BRAND.text}99` }}>
              ARS {Number(byState[k]?.amount || 0).toLocaleString("es-AR")}
            </div>
          </div>
        ))}
      </section>

      {/* Por profesor (solo pagados) */}
      {byProfessor?.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold" style={{ color: BRAND.text }}>
            Desglose por profesor (pagados)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {byProfessor.map((p) => (
              <div
                key={p.professorId}
                className="rounded-xl border p-4 shadow-sm"
                style={{ borderColor: BRAND.soft, background: "#fff" }}
              >
                <div className="font-medium" style={{ color: BRAND.text }}>
                  {p.professorName}
                </div>
                <div className="text-sm" style={{ color: `${BRAND.text}99` }}>
                  {p.count} pagos
                </div>
                <div
                  className="text-xl font-semibold"
                  style={{ color: BRAND.text }}
                >
                  ARS {Number(p.totalAmount || 0).toLocaleString("es-AR")}
                </div>
                <div
                  className="mt-1 text-xs"
                  style={{ color: `${BRAND.text}99` }}
                >
                  transferencia: ARS{" "}
                  {Number(p.byMethod?.transferencia || 0).toLocaleString(
                    "es-AR"
                  )}{" "}
                  · efectivo: ARS{" "}
                  {Number(p.byMethod?.efectivo || 0).toLocaleString("es-AR")} ·
                  otro: ARS{" "}
                  {Number(p.byMethod?.otro || 0).toLocaleString("es-AR")}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Tabla detalle */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold" style={{ color: BRAND.text }}>
            Detalle de inscripciones
          </h2>
          <div className="text-sm" style={{ color: BRAND.text }}>
            Total pagado en la tabla:{" "}
            <b>ARS {Number(list.totalAmount || 0).toLocaleString("es-AR")}</b>
          </div>
        </div>

        <div
          className="grid gap-3 rounded-2xl border p-4 sm:grid-cols-2"
          style={{ borderColor: BRAND.soft }}
        >
          <div>
            <label
              className="block text-sm mb-1 font-medium"
              style={{ color: `${BRAND.text}CC` }}
            >
              Método
            </label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full rounded-xl border bg-white/90 px-3 py-2 shadow-sm outline-none transition focus:ring-2"
              style={{ borderColor: BRAND.soft, color: BRAND.text }}
            >
              <option value="">Todos</option>
              <option value="transferencia">Transferencia</option>
              <option value="efectivo">Efectivo</option>
              <option value="otro">Otro</option>
              <option value="no_aplica">No aplica</option>
            </select>
          </div>
          <div>
            <label
              className="block text-sm mb-1 font-medium"
              style={{ color: `${BRAND.text}CC` }}
            >
              Estado de pago
            </label>
            <select
              value={payState}
              onChange={(e) => setPayState(e.target.value)}
              className="w-full rounded-xl border bg-white/90 px-3 py-2 shadow-sm outline-none transition focus:ring-2"
              style={{ borderColor: BRAND.soft, color: BRAND.text }}
            >
              <option value="">Todos</option>
              <option value="pendiente">Pendiente</option>
              <option value="señado">Señado</option>
              <option value="pagado">Pagado</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>
        </div>

        <div
          className="overflow-x-auto rounded-2xl border"
          style={{ borderColor: BRAND.soft }}
        >
          <table className="min-w-full text-sm">
            <thead
              style={{ background: `${BRAND.soft}66`, color: BRAND.text }}
              className="sticky top-0"
            >
              <tr>
                <th className="text-left px-3 py-2">Alumno</th>
                <th className="text-left px-3 py-2">Profesor</th>
                <th className="text-left px-3 py-2">Estado</th>
                <th className="text-left px-3 py-2">Método</th>
                <th className="text-right px-3 py-2">Monto</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {list.items.map((r) => (
                <tr
                  key={r.id}
                  className="border-t hover:bg-black/[.02]"
                  style={{ borderColor: BRAND.soft }}
                >
                  <td className="px-3 py-2">{r.studentName}</td>
                  <td className="px-3 py-2">{r.professorName}</td>
                  <td className="px-3 py-2">{r.pay.state}</td>
                  <td className="px-3 py-2">{r.pay.method}</td>
                  <td className="px-3 py-2 text-right">
                    {r.pay.state === "pagado" || r.pay.state === "señado"
                      ? `ARS ${Number(r.pay.amount || 0).toLocaleString(
                          "es-AR"
                        )}`
                      : "-"}
                  </td>
                </tr>
              ))}
              {list.items.length === 0 && (
                <tr>
                  <td
                    className="px-3 py-6 text-center"
                    style={{ color: `${BRAND.text}99` }}
                    colSpan={5}
                  >
                    Sin resultados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {loading && (
        <div
          className="text-sm rounded-xl border px-3 py-2 inline-block"
          style={{
            color: BRAND.text,
            backgroundColor: `${BRAND.soft}66`,
            borderColor: BRAND.soft,
          }}
        >
          Cargando…
        </div>
      )}
    </main>
  );
}
