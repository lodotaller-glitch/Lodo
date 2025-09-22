"use client";

import api from "@/lib/axios";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";

const BRAND = { main: "#A08775", soft: "#DDD7C9", text: "#1F1C19" };

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

function Switch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="group inline-flex items-center gap-2"
      aria-pressed={checked}
    >
      <span
        className="relative h-6 w-10 rounded-full transition"
        style={{ backgroundColor: checked ? BRAND.main : `${BRAND.soft}` }}
      >
        <span
          className="absolute top-1 left-1 h-4 w-4 rounded-full bg-white shadow transition"
          style={{ transform: `translateX(${checked ? "16px" : "0"})` }}
        />
      </span>
      <span className="select-none text-sm" style={{ color: BRAND.text }}>
        {label}
      </span>
    </button>
  );
}

export default function UserEditor({
  userId,
  title = "Datos del estudiante",
  branchId: branchIdProp,
  apiPath = "students",
  role,
  professor,
}) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: !role ? "student" : role,
    state: true,
    capacity: 10,
    password: "",
    clayKg: 0, // 👈 nuevo
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const router = useRouter();
  const params = useParams();
  const branchId = branchIdProp || params?.branchId;

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function load() {
    if (!userId) return;
    setLoading(true);
    setError("");
    setOk("");
    try {
      const res = await fetch(`/api/${branchId}/${apiPath}/${userId}`);
      const data = await res.json();
      if (!res.ok)
        throw new Error(data?.error || "No se pudo cargar el usuario");
      setForm({
        name: data.user.name || "",
        email: data.user.email || "",
        role: data.user.role || "student",
        state: Boolean(data.user.state),
        capacity: Number(data.user.capacity ?? 10),
        password: "",
        clayKg: Number(data.user.clayKg ?? 0), // 👈 nuevo
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    setSaving(true);
    setError("");
    setOk("");
    try {
      const res = await fetch(`/api/${branchId}/${apiPath}/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No se pudo guardar");
      setOk("Guardado");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!userId) return;
    const title = "Eliminar " + (!role ? "alumno" : "usuario");
    const text = !role
      ? "Se borrarán sus inscripciones, asistencias y reprogramaciones. Esta acción es irreversible."
      : "Esta acción es irreversible.";
    const resSwal = await Swal.fire({
      title,
      text,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, borrar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
    });
    if (!resSwal.isConfirmed) return;

    setSaving(true);
    setError("");
    setOk("");
    try {
      const { data } = await api.delete(`/${branchId}/${apiPath}/${userId}`);

      if (!data.ok) throw new Error(data?.error || "No se pudo eliminar");

      await Swal.fire({
        title: "Eliminado",
        text: "El alumno y sus datos fueron eliminados.",
        icon: "success",
      });

      // Volver al listado de estudiantes
      router.back();
    } catch (e) {
      await Swal.fire({ title: "Error", text: e.message, icon: "error" });
    } finally {
      setSaving(false);
    }
  }
  

  const isProfessor = useMemo(() => form.role === "professor", [form.role]);

  return (
    <section
      className="space-y-5 rounded-2xl border p-5 shadow-2xl sm:p-6"
      style={{ borderColor: BRAND.soft }}
    >
      {/* Header */}
      <header className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold" style={{ color: BRAND.text }}>
          {title}
        </h2>
        <button
          onClick={handleDelete}
          disabled={saving || form.role === "admin"} // por las dudas, no permitir admins
          className="rounded-xl px-4 py-2 font-medium shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60"
          style={{ backgroundColor: "#ef4444", color: "#fff" }}
          title={
            form.role === "admin"
              ? "No se puede eliminar un admin"
              : form.role !== "student"
              ? "Eliminar usuario"
              : "Eliminar alumno"
          }
        >
          {form.role !== "student" ? "Eliminar usuario" : "Eliminar alumno"}
        </button>
      </header>

      {/* Notices */}
      {loading && <Notice> Cargando… </Notice>}
      {error && <Notice kind="error">{error}</Notice>}
      {ok && <Notice kind="success">{ok}</Notice>}

      {/* Form */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
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
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
        </label>
        <label className="flex flex-col md:col-span-2">
          <span
            className="mb-1 text-sm font-medium"
            style={{ color: `${BRAND.text}CC` }}
          >
            Contraseña
          </span>
          <input
            type="text"
            className="w-full rounded-xl border bg-white/90 px-3 py-2 shadow-sm outline-none transition focus:ring-2"
            placeholder="Dejar vacío para no cambiar"
            style={{ borderColor: BRAND.soft, color: BRAND.text }}
            value={form.password || ""}
            onChange={(e) =>
              setForm((f) => ({ ...f, password: e.target.value }))
            }
          />
        </label>
        {form.role === "student" && (
          <div className="md:col-span-2">
            <label
              className="mb-1 block text-sm font-medium"
              style={{ color: `${BRAND.text}CC` }}
            >
              Arcilla (kg)
            </label>

            <div className="flex flex-col gap-2 md:flex-row md:items-stretch">
              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    clayKg: Math.max(
                      0,
                      Number(((f.clayKg ?? 0) - 1.5).toFixed(2))
                    ),
                  }))
                }
                className="rounded-xl px-4 py-2 font-medium shadow-sm transition whitespace-nowrap md:w-32"
                style={{
                  backgroundColor: `${BRAND.soft}55`,
                  color: BRAND.text,
                  border: `1px solid ${BRAND.main}`,
                }}
              >
                −1,5 kg
              </button>

              <input
                type="number"
                step="0.1"
                min={0}
                className="w-full rounded-xl border bg-white/90 px-3 py-2 text-center shadow-sm outline-none transition focus:ring-2"
                style={{ borderColor: BRAND.soft, color: BRAND.text }}
                value={form.clayKg}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    clayKg: Math.max(0, Number(e.target.value || 0)),
                  }))
                }
              />

              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    clayKg: Number(((f.clayKg ?? 0) + 1.5).toFixed(2)),
                  }))
                }
                className="rounded-xl px-4 py-2 font-medium shadow-sm transition whitespace-nowrap md:w-32"
                style={{ backgroundColor: BRAND.main, color: "#fff" }}
              >
                +1,5 kg
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-4">
          <Switch
            checked={form.state}
            onChange={(v) => setForm((f) => ({ ...f, state: v }))}
            label="Activo"
          />
        </div>
        {isProfessor ? (
          <label className="flex flex-col">
            <span
              className="mb-1 text-sm font-medium"
              style={{ color: `${BRAND.text}CC` }}
            >
              Capacidad (por franja)
            </span>
            <input
              type="number"
              min={1}
              className="w-full rounded-xl border bg-white/90 px-3 py-2 shadow-sm outline-none transition focus:ring-2"
              style={{ borderColor: BRAND.soft, color: BRAND.text }}
              value={form.capacity}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  capacity: Math.max(1, Number(e.target.value || 1)),
                }))
              }
            />
          </label>
        ) : (
          form.role === "student" && (
            <Link
              href={
                !professor
                  ? `/${branchId}/students/${userId}/pieces`
                  : `/professor/students/${userId}/pieces`
              }
              className="rounded-xl px-4 py-2 font-medium shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60"
              style={{ backgroundColor: BRAND.main, color: "#fff" }}
            >
              Piezas del alumno
            </Link>
          )
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-xl px-4 py-2 font-medium shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60"
          style={{ backgroundColor: BRAND.main, color: "#fff" }}
        >
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
        <button
          onClick={load}
          className="rounded-xl border px-4 py-2 text-sm font-medium transition hover:shadow-sm"
          style={{
            borderColor: BRAND.main,
            backgroundColor: `${BRAND.soft}55`,
            color: BRAND.text,
          }}
        >
          Recargar
        </button>
      </div>
    </section>
  );
}
