"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchBranches } from "@/functions/request/branches";
import Swal from "sweetalert2";
import api from "@/lib/axios";

const BRAND = { main: "#A08775", soft: "#DDD7C9", text: "#1F1C19" };

export default function BranchListPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { branches } = await fetchBranches();
        setItems(branches || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleDelete(b) {
    const res = await Swal.fire({
      title: "¿Eliminar sucursal?",
      text: `Se borrará "${b.name}" de forma permanente.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, borrar",
      cancelButtonText: "Cancelar",
      reverseButtons: true,
      confirmButtonColor: BRAND.main,
      cancelButtonColor: "#6B7280",
    });

    if (!res.isConfirmed) return;

    try {
      setDeletingId(b._id);
      const { data } = await api.delete(`/branches/${b._id}`);

      if (!data.ok || data?.ok === false) {
        throw new Error(data?.error || "No se pudo borrar");
      }
      setItems((prev) => prev.filter((x) => x._id !== b._id));
      await Swal.fire({
        title: "Eliminada",
        text: "La sucursal fue eliminada.",
        icon: "success",
        confirmButtonColor: BRAND.main,
      });
    } catch (e) {
      await Swal.fire({
        title: "Error",
        text: e?.message || "No se pudo borrar",
        icon: "error",
        confirmButtonColor: BRAND.main,
      });
    } finally {
      setDeletingId("");
    }
  }

  return (
    <main className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div
        className="flex items-center gap-3 rounded-2xl border px-4 py-3 sm:px-6"
        style={{
          borderColor: BRAND.soft,
          background: `linear-gradient(180deg, ${BRAND.soft}55, transparent)`,
        }}
      >
        <h1 className="text-2xl font-semibold" style={{ color: BRAND.text }}>
          Sucursales
        </h1>
        <Link
          href="/branches/new"
          className="ml-auto rounded-xl px-4 py-2 text-sm font-medium shadow-sm transition hover:shadow"
          style={{ background: BRAND.main, color: "#fff" }}
        >
          Nueva Sucursal
        </Link>
      </div>

      {/* List / Skeleton */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-28 rounded-2xl border"
              style={{ borderColor: BRAND.soft }}
            >
              <div className="h-full w-full animate-pulse rounded-2xl bg-black/5" />
            </div>
          ))}
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((b) => (
            <li
              key={b._id}
              className="rounded-2xl border p-4 shadow-sm transition hover:shadow"
              style={{ borderColor: BRAND.soft, background: "#fff" }}
            >
              <div className="flex justify-between">
                <div className="mb-3">
                  <div
                    className="text-base font-semibold truncate"
                    style={{ color: BRAND.text }}
                  >
                    {b.name}
                  </div>
                  <div className="text-xs" style={{ color: `${BRAND.text}99` }}>
                    {b.code}
                  </div>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => handleDelete(b)}
                    disabled={deletingId === b._id}
                    className="rounded-xl px-3 py-1.5 text-sm font-medium border transition hover:bg-red-50 disabled:opacity-60"
                    style={{
                      borderColor: "#FCA5A5",
                      color: "#991B1B",
                      background: "#fff",
                    }}
                    title="Borrar sucursal"
                  >
                    {deletingId === b._id ? "Borrando…" : "Borrar"}
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span
                  className="rounded-full px-2.5 py-0.5 text-xs"
                  style={{
                    backgroundColor: `${BRAND.soft}`,
                    border: `1px solid ${BRAND.main}55`,
                    color: BRAND.text,
                  }}
                >
                  ID: {b._id}
                </span>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/${b._id}`}
                    className="rounded-xl px-3 py-1.5 text-sm font-medium shadow-sm transition hover:shadow"
                    style={{ background: BRAND.main, color: "#fff" }}
                  >
                    Entrar
                  </Link>
                </div>
              </div>
            </li>
          ))}
          {items.length === 0 && (
            <li
              className="col-span-full rounded-2xl border border-dashed p-6 text-center text-sm"
              style={{
                borderColor: `${BRAND.main}55`,
                color: `${BRAND.text}99`,
              }}
            >
              No hay sucursales para mostrar.
            </li>
          )}
        </ul>
      )}
    </main>
  );
}
