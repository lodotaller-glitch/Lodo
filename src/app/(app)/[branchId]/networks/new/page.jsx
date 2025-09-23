"use client";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { ClipLoader } from "react-spinners"; // <--- paquete externo

function ymToMonthInputValue(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export default function NewStudentAndReschedulePage({ params }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const [resultIns, setResultIns] = useState(null);
  const [errorIns, setErrorIns] = useState("");
  const [loading, setLoading] = useState(false); // <--- estado de carga

  const { branchId } = use(params);
  const route = useRouter();

  async function submitNetwork(e) {
    e.preventDefault();
    if (loading) return;
    setErrorIns("");
    setResultIns(null);
    setLoading(true);

    try {
      const payload = {
        name: form.name,
        email: form.email,
        password: form.password,
        professorId: form.professorId,
        branch: branchId,
      };

      const res = await fetch(`/api/${branchId}/networks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Error creando inscripción");

      setResultIns(data);
      route.push(`/${branchId}/networks`);
    } catch (err) {
      setErrorIns(err.message);
    } finally {
      setLoading(false); // <--- desactiva spinner
    }
  }

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-10">
      <h1 className="text-2xl font-semibold">Usuario de redes</h1>

      <section className="bg-white rounded-2xl shadow p-20 space-y-4">
        <h2 className="text-lg font-medium">Crear usuario de redes</h2>
        <form onSubmit={submitNetwork} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="flex flex-col">
              <span className="text-sm text-gray-600 mb-1">Name</span>
              <input
                className="border rounded-lg px-3 py-2"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                required
                disabled={loading}
              />
            </label>
            <label className="flex flex-col">
              <span className="text-sm text-gray-600 mb-1">Email</span>
              <input
                type="email"
                className="border rounded-lg px-3 py-2"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
                required
                disabled={loading}
              />
            </label>
            <label className="flex flex-col">
              <span className="text-sm text-gray-600 mb-1">Contraseña</span>
              <input
                className="border rounded-lg px-3 py-2"
                value={form.password}
                onChange={(e) =>
                  setForm((f) => ({ ...f, password: e.target.value }))
                }
                disabled={loading}
              />
            </label>
          </div>

          <div className="flex items-center gap-3">
            <button
              className="px-4 py-2 rounded-xl bg-black text-white flex items-center justify-center gap-2"
              disabled={loading}
            >
              {loading ? (
                <>
                  <ClipLoader size={20} color="#fff" /> Creando...
                </>
              ) : (
                "Crear"
              )}
            </button>

            {errorIns && <p className="text-sm text-red-600">{errorIns}</p>}
            {resultIns?.ok && (
              <p className="text-sm text-green-700">Usuario creado</p>
            )}
          </div>
        </form>
      </section>
    </main>
  );
}
