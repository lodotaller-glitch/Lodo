// /app/class/check/page.jsx
"use client";
import { useEffect, useState } from "react";

export default function ClassCheckPage({ searchParams }) {
  const classKey = searchParams?.c || "";
  const [msg, setMsg] = useState("Procesando…");
  const [ok, setOk] = useState(null);

  useEffect(() => {
    if (!classKey) {
      setOk(false);
      setMsg("Falta parámetro 'c'");
      return;
    }
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/class/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ classKey }),
          signal: controller.signal,
        });
        const data = await res.json();
        if (res.ok) {
          setOk(true);
          setMsg(
            data.origin === "regular"
              ? "¡Asistencia registrada!"
              : "¡Asistencia registrada (ad-hoc)!"
          );
        } else {
          setOk(false);
          setMsg(data?.error || "No se pudo registrar la asistencia");
        }
      } catch {
        setOk(false);
        setMsg("Error de red");
      }
    })();
    return () => controller.abort();
  }, [classKey]);

  return (
    <main className="max-w-md mx-auto p-6">
      <h1 className="text-xl font-semibold mb-2">Marcación de asistencia</h1>
      <p className={ok === null ? "" : ok ? "text-green-700" : "text-red-700"}>
        {msg}
      </p>
    </main>
  );
}
