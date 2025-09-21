"use client";

import { useAuth } from "@/context/AuthContext";
import { useState } from "react";

const BRAND = { main: "#A08775", soft: "#DDD7C9", text: "#1F1C19" };

export default function ProfessorProfilePage() {
  const { user, refresh } = useAuth();
  const [form, setForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    password: "",
  });
  const [status, setStatus] = useState("");

  async function save(e) {
    e.preventDefault();
    if (!user) return;
    setStatus("loading");
    try {
      const res = await fetch(`/api/${user.branch}/students/${user._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password || undefined,
        }),
      });
      if (!res.ok) throw new Error("No se pudo guardar");
      setStatus("saved");
      await refresh();
    } catch (e) {
      console.error(e);
      setStatus("error");
    }
  }

  return (
    <main className="mx-auto max-w-md p-4 sm:p-6 space-y-4">
      <h1 className="text-2xl font-semibold" style={{ color: BRAND.text }}>
        Perfil
      </h1>

      <form
        onSubmit={save}
        className="space-y-4 rounded-2xl border p-4 shadow-sm sm:p-6"
        style={{ borderColor: BRAND.soft, background: "#fff" }}
      >
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
            onChange={(e) => setForm({ ...form, name: e.target.value })}
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
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </label>

        <label className="flex flex-col">
          <span
            className="mb-1 text-sm font-medium"
            style={{ color: `${BRAND.text}CC` }}
          >
            Contraseña
          </span>
          <input
            type="password"
            className="w-full rounded-xl border bg-white/90 px-3 py-2 shadow-sm outline-none transition focus:ring-2"
            style={{ borderColor: BRAND.soft, color: BRAND.text }}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="(sin cambios)"
          />
        </label>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="rounded-xl px-4 py-2 font-medium shadow-sm transition"
            style={{ background: BRAND.main, color: "#fff" }}
          >
            Guardar cambios
          </button>

          {status === "saved" && (
            <p
              className="text-sm rounded-xl border px-3 py-2"
              style={{
                color: "#166534",
                backgroundColor: "#ECFDF5",
                borderColor: "#86EFAC",
              }}
            >
              Guardado
            </p>
          )}
          {status === "error" && (
            <p
              className="text-sm rounded-xl border px-3 py-2"
              style={{
                color: "#991B1B",
                backgroundColor: "#FEF2F2",
                borderColor: "#FECACA",
              }}
            >
              Error al guardar
            </p>
          )}
          {status === "loading" && (
            <p
              className="text-sm rounded-xl border px-3 py-2"
              style={{
                color: BRAND.text,
                backgroundColor: `${BRAND.soft}66`,
                borderColor: BRAND.soft,
              }}
            >
              Guardando…
            </p>
          )}
        </div>
      </form>
    </main>
  );
}
