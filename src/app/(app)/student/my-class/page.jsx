"use client";
import { useRouter } from "next/navigation";
import { useState, use } from "react";
import { useAuth } from "@/context/AuthContext";
import { format } from "date-fns";
import es from "date-fns/locale/es";

const BRAND = { main: "#A08775", soft: "#DDD7C9", text: "#1F1C19" };

export default function MyClassPage({ searchParams }) {
  const { start, professorId } = use(searchParams);
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [code, setCode] = useState("");
  const router = useRouter();

  const startDate = start ? new Date(start) : null;

  async function mark() {
    if (!user) return;
    try {
      const res = await fetch(`/api/${user.branch}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: user.id,
          professorId,
          date: start,
          code,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No se pudo marcar");
      setMessage("Asistencia registrada");
    } catch (e) {
      setMessage(e.message);
    }
  }

  function handleReschedule() {
    console.log(user, start, professorId);

    if (user && start && professorId) {
      console.log("Hola");
      router.push(
        `/student/my-class/reschedule?start=${encodeURIComponent(
          start
        )}&profesorId=${professorId}`
      );
    }
  }

  return (
    <main className="p-4 space-y-6">
      <h1 className="text-xl font-semibold" style={{ color: BRAND.main }}>
        Mi clase
      </h1>
      {startDate && (
        <p className="text-sm" style={{ color: BRAND.text }}>
          {format(startDate, "PPPP p", { locale: es })}
        </p>
      )}
      <section className="bg-white rounded-2xl shadow p-4 space-y-4">
        <p className="text-sm" style={{ color: BRAND.text }}>
          Escanea el código QR entregado por tu profesor o ingresá el código
          manualmente para registrar tu asistencia.
        </p>
        <input
          className="border rounded-lg px-3 py-2 w-full"
          placeholder="Código QR"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          style={{ borderColor: BRAND.soft }}
        />
        <button
          // onClick={mark}
          className="px-4 py-2 rounded-xl text-white"
          style={{ background: BRAND.main }}
        >
          Marcar asistencia
        </button>
        {message && (
          <p className="text-sm" style={{ color: BRAND.main }}>
            {message}
          </p>
        )}
      </section>
      {user && (
        <button
          onClick={handleReschedule}
          className="px-4 py-2 rounded-xl inline-block text-white"
          style={{ background: BRAND.main }}
        >
          Reprogramar clase
        </button>
      )}
    </main>
  );
}
