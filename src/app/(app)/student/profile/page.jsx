"use client";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
const BRAND = { main: "#A08775", soft: "#DDD7C9", text: "#1F1C19" };

function PayBadge({ estado }) {
  const cfg = useMemo(() => {
    const base = { bg: `${BRAND.soft}`, br: `${BRAND.main}55`, tx: BRAND.text };
    const map = {
      pendiente: base,
      señado: { bg: `${BRAND.soft}AA`, br: `${BRAND.main}77`, tx: BRAND.text },
      pagado: { bg: `#ECFDF5`, br: `#86EFAC`, tx: `#166534` },
      cancelado: { bg: `#FEF2F2`, br: `#FECACA`, tx: `#991B1B` },
    };
    return map[String(estado || "pendiente").toLowerCase()] || base;
  }, [estado]);
  return (
    <span
      className="rounded-full px-2.5 py-0.5 text-xs"
      style={{
        backgroundColor: cfg.bg,
        border: `1px solid ${cfg.br}`,
        color: cfg.tx,
      }}
    >
      {estado || "pendiente"}
    </span>
  );
}

export default function ProfilePage() {
  const { user, refresh } = useAuth();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    clayKg: 0,
  });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null); // {type:'success'|'error'|'info', text}
  const [enrollments, setEnrollments] = useState([]);
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || "",
        email: user.email || "",
        password: "",
        clayKg: user.clayKg || 0,
      });
    }
  }, [user]);

  useEffect(() => {
    async function load() {
      if (!user?._id || !user?.branch) return;
      try {
        const res = await fetch(
          `/api/${user.branch}/enrollments/by-student/${user._id}`
        );
        const data = await res.json();
        if (res.ok)
          setEnrollments(
            Array.isArray(data.enrollments) ? data.enrollments : []
          );
      } catch {}
    }
    load();
  }, [user?._id, user?.branch]);

  async function save() {
    if (!user?.branch || !user?._id) return;
    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/${user.branch}/students/${user._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No se pudo guardar");
      setNotice({ type: "success", text: "Datos actualizados" });
      await refresh();

      setForm((f) => ({ ...f, password: "" }));
    } catch (e) {
      setNotice({ type: "error", text: e.message });
    } finally {
      setSaving(false);
    }
  }

  // Ordenar inscripciones por año/mes desc
  const sorted = useMemo(() => {
    return [...enrollments].sort(
      (a, b) => b.year - a.year || b.month - a.month
    );
  }, [enrollments]);

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-6 space-y-6">
      {/* Encabezado */}
      <div
        className="rounded-2xl border"
        style={{
          borderColor: BRAND.soft,
          background: `linear-gradient(180deg, ${BRAND.soft}55, transparent)`,
        }}
      >
        <div className="flex items-center justify-between px-4 py-3 sm:px-6">
          <h1 className="text-xl font-semibold" style={{ color: BRAND.text }}>
            Perfil
          </h1>
          {/* {user?.role && (
            <span
              className="rounded-full px-3 py-1 text-xs"
              style={{
                backgroundColor: BRAND.soft,
                color: BRAND.text,
                border: `1px solid ${BRAND.main}55`,
              }}
            >
              {user.role}
            </span>
          )} */}
        </div>
      </div>

      {/* Layout principal */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Formulario */}
        <section
          className="lg:col-span-2 space-y-4 rounded-2xl border p-4 shadow-sm sm:p-6"
          style={{ borderColor: BRAND.soft }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col">
              <span
                className="mb-1 text-sm font-medium"
                style={{ color: `${BRAND.text}CC` }}
              >
                Nombre
              </span>
              <input
                className="w-full rounded-xl border bg-white/90 px-3 py-2 shadow-sm outline-none transition focus:ring-2"
                style={{ borderColor: BRAND.soft, color: BRAND.text }}
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </label>
            <label className="flex flex-col">
              <span
                className="mb-1 text-sm font-medium"
                style={{ color: `${BRAND.text}CC` }}
              >
                Email
              </span>
              <input
                type="email"
                className="w-full rounded-xl border bg-white/90 px-3 py-2 shadow-sm outline-none transition focus:ring-2"
                style={{ borderColor: BRAND.soft, color: BRAND.text }}
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
              />
            </label>
            <label className="sm:col-span-2 flex flex-col">
              <span
                className="mb-1 text-sm font-medium"
                style={{ color: `${BRAND.text}CC` }}
              >
                Contraseña
              </span>
              <div className="flex items-center gap-2">
                <input
                  type={showPass ? "text" : "password"}
                  className="w-full rounded-xl border bg-white/90 px-3 py-2 shadow-sm outline-none transition focus:ring-2"
                  style={{ borderColor: BRAND.soft, color: BRAND.text }}
                  value={form.password}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, password: e.target.value }))
                  }
                  placeholder="Dejar vacío para no cambiar"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((s) => !s)}
                  className="shrink-0 rounded-xl border px-3 py-2 text-sm transition hover:shadow-sm"
                  style={{
                    borderColor: BRAND.main,
                    backgroundColor: `${BRAND.soft}55`,
                    color: BRAND.text,
                  }}
                >
                  {showPass ? "Ocultar" : "Mostrar"}
                </button>
              </div>
            </label>
            <label className="flex flex-col sm:col-span-2">
              <span
                className="mb-1 text-sm font-medium"
                style={{ color: `${BRAND.text}CC` }}
              >
                Arcilla (kg)
              </span>
              <input
                type="text"
                disabled
                readOnly
                value={
                  form.clayKg === null || Number.isNaN(form.clayKg)
                    ? "—"
                    : form.clayKg.toFixed(2).replace(".", ",")
                }
                className="w-full rounded-xl border bg-gray-50 px-3 py-2 shadow-sm outline-none"
                style={{
                  borderColor: BRAND.soft,
                  color: BRAND.text,
                  cursor: "not-allowed",
                }}
              />
            </label>
          </div>

          {notice && (
            <p
              role="alert"
              className="rounded-xl border px-3 py-2 text-sm"
              style={{
                color:
                  notice.type === "success"
                    ? "#166534"
                    : notice.type === "error"
                    ? "#991B1B"
                    : BRAND.text,
                backgroundColor:
                  notice.type === "success"
                    ? "#ECFDF5"
                    : notice.type === "error"
                    ? "#FEF2F2"
                    : `${BRAND.soft}66`,
                borderColor:
                  notice.type === "success"
                    ? "#86EFAC"
                    : notice.type === "error"
                    ? "#FECACA"
                    : BRAND.soft,
              }}
            >
              {notice.text}
            </p>
          )}

          <div className="flex gap-3">
            <button
              onClick={save}
              disabled={saving}
              className="rounded-xl px-4 py-2 font-medium shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60"
              style={{ backgroundColor: BRAND.main, color: "#fff" }}
            >
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, password: "" }))}
              className="rounded-xl border px-4 py-2 text-sm font-medium transition hover:shadow-sm"
              style={{
                borderColor: BRAND.main,
                backgroundColor: `${BRAND.soft}55`,
                color: BRAND.text,
              }}
            >
              Limpiar contraseña
            </button>
          </div>
        </section>

        {/* Inscripciones */}
        <section
          className="space-y-3 rounded-2xl border p-4 shadow-sm sm:p-6"
          style={{ borderColor: BRAND.soft }}
        >
          <h2 className="text-base font-semibold" style={{ color: BRAND.text }}>
            Meses inscritos
          </h2>
          {sorted.length === 0 ? (
            <div
              className="rounded-xl border border-dashed p-4 text-sm text-center"
              style={{
                borderColor: `${BRAND.main}55`,
                color: `${BRAND.text}99`,
              }}
            >
              No hay inscripciones todavía.
            </div>
          ) : (
            <ul className="divide-y" style={{ borderColor: BRAND.soft }}>
              {sorted.map((e) => (
                <li
                  key={e._id}
                  className="flex items-center justify-between gap-3 py-2 text-sm"
                >
                  <span style={{ color: BRAND.text }}>
                    {String(e.month).padStart(2, "0")}/{e.year}
                  </span>
                  <div className="flex items-center gap-2">
                    {e.professor?.name && (
                      <span
                        className="truncate text-xs"
                        style={{ color: `${BRAND.text}99` }}
                      >
                        {e.professor.name}
                      </span>
                    )}
                    <PayBadge estado={e.pay?.state || "pendiente"} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
