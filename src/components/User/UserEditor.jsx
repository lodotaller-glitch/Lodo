"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function UserEditor({ userId, title = "Datos del estudiante" }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "student",
    state: true,
    capacity: 10,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const router = useRouter();
  const { branchId } = useParams();

  useEffect(() => {
    load();
  }, [userId]);

  async function load() {
    if (!userId) return;
    setLoading(true);
    setError("");
    setOk("");
    try {
      const res = await fetch(`/api/${branchId}/students/${userId}`);
      const data = await res.json();
      if (!res.ok)
        throw new Error(data?.error || "No se pudo cargar el usuario");
      setForm({
        name: data.user.name,
        email: data.user.email,
        role: data.user.role,
        state: Boolean(data.user.state),
        capacity: Number(data.user.capacity ?? 10),
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
      const res = await fetch(`/api/students/${userId}`, {
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

  return (
    <section className="bg-white rounded-2xl shadow p-5 space-y-4">
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
        <span className="text-xs text-gray-500">
          ID: {String(userId || "—")}
        </span>
      </header>

      {loading && (
        <div className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-3">
          Cargando…
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {ok && <p className="text-sm text-green-700">{ok}</p>}
      <button
        onClick={() => router.push(`/students/${userId}/cambiar-horario`)}
      >
        Cambiar horario
      </button>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="flex flex-col">
          <span className="text-sm text-gray-600 mb-1">Nombre</span>
          <input
            className="border rounded-lg px-3 py-2"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </label>
        <label className="flex flex-col">
          <span className="text-sm text-gray-600 mb-1">Email</span>
          <input
            type="email"
            className="border rounded-lg px-3 py-2"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
        </label>
        <label className="flex flex-col">
          <span className="text-sm text-gray-600 mb-1">Rol</span>
          <select
            className="border rounded-lg px-3 py-2"
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
          >
            <option value="student">student</option>
            <option value="professor">professor</option>
            <option value="networks">networks</option>
            <option value="admin">admin</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.state}
            onChange={(e) =>
              setForm((f) => ({ ...f, state: e.target.checked }))
            }
          />
          <span className="text-sm text-gray-700">Activo</span>
        </label>
        {form.role === "professor" && (
          <label className="flex flex-col">
            <span className="text-sm text-gray-600 mb-1">
              Capacidad (por franja)
            </span>
            <input
              type="number"
              min={1}
              className="border rounded-lg px-3 py-2"
              value={form.capacity}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  capacity: Number(e.target.value || 1),
                }))
              }
            />
          </label>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 rounded-xl bg-black text-white disabled:opacity-60"
        >
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
        <button onClick={load} className="px-4 py-2 rounded-xl border">
          Recargar
        </button>
      </div>
    </section>
  );
}
