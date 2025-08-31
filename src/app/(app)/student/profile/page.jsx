"use client";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";

const BRAND = { main: "#A08775", soft: "#DDD7C9", text: "#1F1C19" };

export default function ProfilePage() {
  const { user, refresh } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [enrollments, setEnrollments] = useState([]);

  useEffect(() => {
    if (user) {
      setForm({ name: user.name || "", email: user.email || "", password: "" });
    }
  }, [user]);

  useEffect(() => {
    async function load() {
      if (!user) return;
      try {
        const res = await fetch(
          `/api/${user.branch}/enrollments/by-student/${user._id}`
        );
        const data = await res.json();
        if (res.ok) setEnrollments(data.enrollments || []);
      } catch {}
    }
    load();
  }, [user]);

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch(`/api/${user.branch}/students/${user._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No se pudo guardar");
      setMessage("Datos actualizados");
      await refresh();
      setForm((f) => ({ ...f, password: "" }));
    } catch (e) {
      setMessage(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="p-4 space-y-6">
      <section className="bg-white rounded-2xl shadow p-4 space-y-4">
        <h1 className="text-xl font-semibold" style={{ color: BRAND.main }}>
          Perfil
        </h1>
        <label className="flex flex-col">
          <span className="text-sm mb-1" style={{ color: BRAND.text }}>
            Nombre
          </span>
          <input
            className="border rounded-lg px-3 py-2"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            style={{ borderColor: BRAND.soft }}
          />
        </label>
        <label className="flex flex-col">
          <span className="text-sm mb-1" style={{ color: BRAND.text }}>
            Email
          </span>
          <input
            type="email"
            className="border rounded-lg px-3 py-2"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            style={{ borderColor: BRAND.soft }}
          />
        </label>
        <label className="flex flex-col">
          <span className="text-sm mb-1" style={{ color: BRAND.text }}>
            Contraseña
          </span>
          <input
            type="password"
            className="border rounded-lg px-3 py-2"
            value={form.password}
            onChange={(e) =>
              setForm((f) => ({ ...f, password: e.target.value }))
            }
            style={{ borderColor: BRAND.soft }}
          />
        </label>
        {message && (
          <p className="text-sm" style={{ color: BRAND.main }}>
            {message}
          </p>
        )}
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 rounded-xl text-white"
          style={{ background: BRAND.main }}
        >
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
      </section>

      <section className="bg-white rounded-2xl shadow p-4 space-y-2">
        <h2 className="text-lg font-semibold" style={{ color: BRAND.main }}>
          Meses inscritos
        </h2>
        <ul className="divide-y">
          {enrollments.map((e) => (
            <li key={e._id} className="flex justify-between py-1 text-sm">
              <span style={{ color: BRAND.text }}>
                {String(e.month).padStart(2, "0")}/{e.year}
              </span>
              <span style={{ color: BRAND.text }}>
                {e.pago?.estado ? e.pago.estado : "pendiente"}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
