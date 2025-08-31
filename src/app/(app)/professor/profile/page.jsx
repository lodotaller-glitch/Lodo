"use client";

import { useAuth } from "@/context/AuthContext";
import { useState } from "react";

export default function ProfessorProfilePage() {
  const { user } = useAuth();
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
    } catch (e) {
      console.error(e);
      setStatus("error");
    }
  }

  return (
    <main className="max-w-md mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Perfil</h1>
      <form onSubmit={save} className="space-y-4">
        <label className="flex flex-col">
          <span className="text-sm text-gray-600 mb-1">Nombre</span>
          <input
            className="border rounded-lg px-3 py-2"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>
        <label className="flex flex-col">
          <span className="text-sm text-gray-600 mb-1">Email</span>
          <input
            type="email"
            className="border rounded-lg px-3 py-2"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </label>
        <label className="flex flex-col">
          <span className="text-sm text-gray-600 mb-1">Contraseña</span>
          <input
            type="password"
            className="border rounded-lg px-3 py-2"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="(sin cambios)"
          />
        </label>
        <button
          type="submit"
          className="px-4 py-2 rounded-xl text-white"
          style={{ background: "#A08775" }}
        >
          Guardar cambios
        </button>
        {status === "saved" && (
          <p className="text-sm text-green-700">Guardado</p>
        )}
        {status === "error" && (
          <p className="text-sm text-red-600">Error al guardar</p>
        )}
      </form>
    </main>
  );
}