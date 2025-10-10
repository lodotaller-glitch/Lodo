"use client";
import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { ClipLoader } from "react-spinners";
import api from "@/lib/axios";
import { useAuth } from "@/context/AuthContext";

const PAGE_SIZE = 15;
const BRAND = { main: "#A08775", soft: "#DDD7C9", text: "#1F1C19" };
const STATUSES = [
  "",
  "Lista",
  "En preparacion",
  "En el horno",
  "Destruida",
  "Sin terminar",
];

function StatusBadge({ status }) {
  const palette = useMemo(() => {
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

export default function PiecesAdminPage() {
  const { user } = useAuth();
  const branchId = user?.branch;

  // data
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // filters
  const [qPiece, setQPiece] = useState("");
  const [qStudent, setQStudent] = useState("");
  const [qStatus, setQStatus] = useState("");
  const [dateOrder, setDateOrder] = useState("asc");

  // paginado
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // UI
  const [savingId, setSavingId] = useState(null);
  const [loadingId, setLoadingId] = useState(null);

  // build query string
  function buildQuery() {
    const params = new URLSearchParams();
    if (qPiece.trim()) params.set("title", qPiece.trim());
    if (qStudent.trim()) params.set("studentName", qStudent.trim());
    if (qStatus) params.set("status", qStatus);
    params.set("page", page);
    params.set("limit", PAGE_SIZE);
    params.set("order", dateOrder);
    return params.toString() ? `?${params.toString()}` : "";
  }

  async function fetchPieces() {
    setLoading(true);
    setError("");
    try {
      const qs = buildQuery();
      const { data } = await api.get(`/${branchId}/pieces${qs}`);
      if (!data.ok) throw new Error(data.error || "Error al cargar piezas");
      setItems(data.pieces || []);
      setTotalPages(data.totalPages || 1);
    } catch (e) {
      if (e.name !== "AbortError") setError(e.message);
    }
    setLoading(false);
  }
  // debounce filters
  useEffect(() => {
    fetchPieces(); // no creamos AbortController
  }, [branchId, page]);

  async function changeStatus(pieceId, newStatus) {
    setLoadingId(pieceId);
    setError("");
    const old = items;
    setSavingId(pieceId);
    setItems((prev) =>
      prev.map((p) => (p._id === pieceId ? { ...p, status: newStatus } : p))
    );
    try {
      const { data } = await api.put(`/${branchId}/pieces/${pieceId}`, {
        status: newStatus,
      });
      if (!data.ok) throw new Error(data.error || "No se pudo actualizar");
      if (data.piece)
        setItems((prev) =>
          prev.map((p) => (p._id === pieceId ? data.piece : p))
        );
    } catch (e) {
      setError(e.message);
      setItems(old);
    } finally {
      setSavingId(null);
      setLoadingId(null);
      fetchPieces();
    }
  }

  function clearFilters() {
    setQPiece("");
    setQStudent("");
    setQStatus("");
  }

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold" style={{ color: BRAND.text }}>
          Todas las piezas
        </h1>
        <div className="text-sm" style={{ color: `${BRAND.text}99` }}>
          {items.length} {items.length === 1 ? "pieza" : "piezas"}
        </div>
      </div>

      {/* filtros */}
      <div
        className="mb-6 rounded-2xl border p-4"
        style={{ borderColor: BRAND.soft }}
      >
        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <label
              className="block text-xs font-medium"
              style={{ color: `${BRAND.text}CC` }}
            >
              Nombre de pieza
            </label>
            <input
              value={qPiece}
              onChange={(e) => setQPiece(e.target.value)}
              placeholder="Buscar por título"
              className="mt-1 w-full rounded-xl border bg-white/90 px-3 py-2 outline-none"
              style={{ borderColor: BRAND.soft, color: BRAND.text }}
            />
          </div>

          <div>
            <label
              className="block text-xs font-medium"
              style={{ color: `${BRAND.text}CC` }}
            >
              Nombre de alumno
            </label>
            <input
              value={qStudent}
              onChange={(e) => setQStudent(e.target.value)}
              placeholder="Nombre del estudiante"
              className="mt-1 w-full rounded-xl border bg-white/90 px-3 py-2 outline-none"
              style={{ borderColor: BRAND.soft, color: BRAND.text }}
            />
          </div>
          <div className="sm:col-span-2">
            <label
              className="block text-xs font-medium"
              style={{ color: `${BRAND.text}CC` }}
            >
              Orden
            </label>
            <select
              value={dateOrder}
              onChange={(e) => setDateOrder(e.target.value)}
              className="mt-1 w-full rounded-xl border bg-white/90 px-3 py-2 outline-none"
              style={{ borderColor: BRAND.soft, color: BRAND.text }}
            >
              <option value="desc">Más recientes primero</option>
              <option value="asc">Más antiguas primero</option>
            </select>{" "}
          </div>

          <div className="sm:col-span-2">
            <label
              className="block text-xs font-medium"
              style={{ color: `${BRAND.text}CC` }}
            >
              Estado
            </label>
            <select
              value={qStatus}
              onChange={(e) => setQStatus(e.target.value)}
              className="mt-1 w-full rounded-xl border bg-white/90 px-3 py-2 outline-none"
              style={{ borderColor: BRAND.soft, color: BRAND.text }}
            >
              <option value="">Todos</option>
              {STATUSES.filter(Boolean).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2 flex items-end gap-2">
            <button
              type="button"
              onClick={() => fetchPieces()}
              className="rounded-xl px-3 py-2 text-sm"
              style={{ backgroundColor: BRAND.main, color: "#fff" }}
            >
              Aplicar
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-xl px-3 py-2 text-sm border"
              style={{
                borderColor: BRAND.soft,
                color: BRAND.text,
                backgroundColor: `${BRAND.soft}55`,
              }}
            >
              Limpiar
            </button>
          </div>
        </div>
      </div>

      {/* listado */}
      {loading ? (
        <div className="flex justify-center py-20">
          <ClipLoader color={BRAND.main} size={50} />
        </div>
      ) : error ? (
        <p className="text-red-600">{error}</p>
      ) : items.length === 0 ? (
        <div
          className="rounded-2xl border border-dashed p-8 text-center"
          style={{
            borderColor: `${BRAND.main}66`,
            color: `${BRAND.text}99`,
            background: `linear-gradient(180deg, ${BRAND.soft}55, transparent)`,
          }}
        >
          <p className="mx-auto max-w-md text-sm">
            No hay piezas que coincidan con los filtros.
          </p>
        </div>
      ) : (
        <>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((p) => {
              const images = Array.isArray(p.images) ? p.images : [];
              return (
                <li
                  key={p._id}
                  className="group flex flex-col rounded-2xl border p-4 transition hover:shadow-sm"
                  style={{ borderColor: BRAND.soft }}
                >
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
                          <Image
                            src={images[0]}
                            alt={`Imagen de ${p.title || "pieza"}`}
                            className="h-full w-full object-cover transition group-hover:scale-[1.01]"
                            width={300}
                            height={300}
                            loading="lazy"
                            decoding="async"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  {loadingId === p._id ? (
                    <div className="flex justify-center py-10">
                      <ClipLoader color={BRAND.main} size={50} />
                    </div>
                  ) : (
                    <>
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
                            {p.studentName || p.student?.name || "-"} •{" "}
                            {p.createdAt
                              ? new Date(p.createdAt).toLocaleDateString()
                              : "-"}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <StatusBadge status={p.status} />
                          <select
                            value={p.status || ""}
                            onChange={(e) =>
                              changeStatus(p._id, e.target.value)
                            }
                            disabled={savingId === p._id}
                            className="rounded-xl border px-2 py-1 text-sm outline-none"
                            style={{
                              borderColor: BRAND.soft,
                              color: BRAND.text,
                            }}
                            aria-label={`Cambiar estado de ${p.title}`}
                          >
                            {STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {s || "—"}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center gap-2">
                        <a
                          href={`/professor/students/${
                            p.studentId || p.student?._id
                          }/pieces/${p._id}`}
                          className="inline-flex items-center justify-center rounded-xl px-3 py-1.5 text-sm font-medium shadow-sm transition"
                          style={{ backgroundColor: BRAND.main, color: "#fff" }}
                        >
                          Ver / Editar
                        </a>
                      </div>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
          {/* paginación */}
          <div className="mt-6 flex justify-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 rounded border"
              style={{ borderColor: BRAND.soft, color: BRAND.text }}
            >
              Anterior
            </button>
            <span className="px-3 py-1 text-sm" style={{ color: BRAND.text }}>
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 rounded border"
              style={{ borderColor: BRAND.soft, color: BRAND.text }}
            >
              Siguiente
            </button>
          </div>
        </>
      )}
    </div>
  );
}
