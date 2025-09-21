"use client";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const BRAND = { main: "#A08775", soft: "#DDD7C9", text: "#1F1C19" };

function StatusBadge({ status }) {

  const palette = useMemo(() => {
    // Variaciones sutiles manteniendo la marca
    const base = {
      bg: `${BRAND.soft}8A`,
      border: `${BRAND.main}55`,
      text: BRAND.text,
    };
    const map = {
      Lista: base,
      "En preparacion": {
        bg: `${BRAND.soft}AA`,
        border: `${BRAND.main}77`,
        text: BRAND.text,
      },
      "En el horno": {
        bg: `${BRAND.soft}AA`,
        border: `${BRAND.main}AA`,
        text: BRAND.text,
      },
      Destruida: { bg: "#FEF2F2", border: "#FECACA", text: "#991B1B" },
      "Sin terminar": {
        bg: `${BRAND.soft}7A`,
        border: `${BRAND.main}55`,
        text: BRAND.text,
      },
    };
    return map[status] || base;
  }, [status]);

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs"
      style={{
        backgroundColor: palette.bg,
        border: `1px solid ${palette.border}`,
        color: palette.text,
      }}
    >
      {status || "—"}
    </span>
  );
}

export default function PiecesOfStudent({ studentId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { branchId } = useParams();

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/${branchId}/pieces?student=${studentId}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Error");
      setItems(json.pieces);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [studentId]);

  async function changeStatus(id, status) {
    const res = await fetch(`/api/${branchId}/pieces/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const json = await res.json();
    if (!json.ok) {
      alert(json.error || "No se pudo actualizar");
      return;
    }
    setItems((prev) => prev.map((p) => (p._id === id ? { ...p, status } : p)));
    if (status === "Lista")
      alert(
        "Estado actualizado a Lista. Si el alumno tiene email, fue notificado."
      );
  }

  if (loading) return <p>Cargando…</p>;
  if (error) return <p className="text-red-600">{error}</p>;

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      {/* Encabezado */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold" style={{ color: BRAND.text }}>
          Piezas
        </h2>
        <span className="text-sm" style={{ color: `${BRAND.text}99` }}>
          {items.length} {items.length === 1 ? "pieza" : "piezas"}
        </span>
      </div>

      {/* Error */}
      {error && (
        <div
          className="mb-4 flex items-start justify-between gap-3 rounded-xl border px-3 py-2 text-sm"
          style={{
            color: "#991B1B",
            backgroundColor: "#FEF2F2",
            borderColor: "#FECACA",
          }}
        >
          <p>{error}</p>
          <button
            onClick={() => load()}
            className="rounded-lg px-3 py-1 text-xs font-medium"
            style={{
              backgroundColor: BRAND.soft,
              color: BRAND.text,
              border: `1px solid ${BRAND.main}55`,
            }}
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Vacío */}
      {items.length === 0 ? (
        <div
          className="rounded-2xl border border-dashed p-8 text-center"
          style={{
            borderColor: `${BRAND.main}66`,
            color: `${BRAND.text}99`,
            background: `linear-gradient(180deg, ${BRAND.soft}55, transparent)`,
          }}
        >
          <p className="mx-auto max-w-md text-sm">
            Todavía no subiste ninguna pieza. Cuando cargues imágenes, van a
            aparecer acá.
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => {
            const images = Array.isArray(p.images) ? p.images : [];
            return (
              <li
                key={p._id}
                className="group flex flex-col rounded-2xl border p-4 transition hover:shadow-sm"
                style={{ borderColor: BRAND.soft }}
              >
                {/* Media */}
                <div className="grid grid-cols-4 gap-2">
                  {images.length === 0 ? (
                    <div
                      className="col-span-4 flex aspect-[4/3] items-center justify-center rounded-xl border border-dashed text-xs"
                      style={{
                        borderColor: `${BRAND.main}55`,
                        color: `${BRAND.text}99`,
                      }}
                    >
                      Sin imágenes
                    </div>
                  ) : (
                    <div key={images[0]} className={`relative col-span-4`}>
                      <div
                        className="aspect-[4/3] w-full overflow-hidden rounded-xl border"
                        style={{ borderColor: BRAND.soft }}
                      >
                        <img
                          src={images[0]}
                          alt={`Imagen de ${p.title || "pieza"}`}
                          className="h-full w-full object-cover transition group-hover:scale-[1.01]"
                          loading="lazy"
                          decoding="async"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Meta */}
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3
                      className="truncate text-base font-semibold"
                      style={{ color: BRAND.text }}
                    >
                      {p.title || "(sin título)"}
                    </h3>
                    <div
                      className="mt-1 text-xs"
                      style={{ color: `${BRAND.text}99` }}
                    >
                      {images.length}{" "}
                      {images.length === 1 ? "imagen" : "imágenes"}
                    </div>
                  </div>
                  <StatusBadge status={p.status} />
                </div>

                {/* Acciones */}
                <div className="mt-3 flex items-center gap-2">
                  <a
                    href={`/${branchId}/students/${studentId}/pieces/${p._id}`}
                    className="inline-flex items-center justify-center rounded-xl px-3 py-1.5 text-sm font-medium shadow-sm transition"
                    style={{ backgroundColor: BRAND.main, color: "#fff" }}
                  >
                    Ver / Editar
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
