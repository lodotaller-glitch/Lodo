"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import NetworksTable from "@/components/Networks/NetworksTable";
import Pagination from "@/components/Common/Pagination";
import { fetchNetworks } from "@/functions/request/networks";

const BRAND = { main: "#A08775", soft: "#DDD7C9", text: "#1F1C19" };

export default function NetworksList() {
  const router = useRouter();
  const { branchId } = useParams();

  const [q, setQ] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const params = useMemo(
    () => ({ q, page, limit, state: stateFilter, branch: branchId }),
    [q, page, limit, stateFilter, branchId]
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await fetchNetworks(params);
        if (!alive) return;
        setItems(data.items || []);
        setTotal(data.total || 0);
      } catch (e) {
        if (!alive) return;
        setError(e?.message || "Error al cargar");
        setItems([]);
        setTotal(0);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [params]);

  function handleCreate() {
    router.push(`/${branchId}/networks/new`);
  }
  function handleEdit(id) {
    router.push(`/${branchId}/networks/${id}/edit`);
  }

  return (
    <section className="space-y-4">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Usuarios de redes</h1>
          <p className="text-sm text-gray-600">
            Listado de usuarios de redes. Podés entrar a cada uno para editarlo.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleCreate}
            className="px-4 py-2 rounded-xl text-white"
            style={{ background: BRAND.main }}
          >
            + Crear usuario
          </button>
        </div>
      </header>

      {/* Card principal */}
      <div className="bg-white rounded-2xl shadow p-4 space-y-3">
        {/* Filtros (estilo Estudiantes) */}
        <div
          className="rounded-2xl border p-4 sm:p-5 shadow-sm"
          style={{
            borderColor: BRAND.soft,
            background: `linear-gradient(180deg, ${BRAND.soft}55, #ffffff)`,
          }}
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            {/* Búsqueda + Estado */}
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="sm:col-span-2 flex flex-col">
                <span
                  className="text-sm mb-1"
                  style={{ color: `${BRAND.text}CC` }}
                >
                  Buscar
                </span>
                <div className="relative">
                  <input
                    value={q}
                    onChange={(e) => {
                      setQ(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Nombre o email"
                    className="w-full rounded-xl border bg-white px-3 py-2.5 pl-9 text-sm shadow-sm outline-none transition focus:ring-2"
                    style={{ borderColor: BRAND.soft, color: BRAND.text }}
                  />
                  <svg
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-60"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    style={{ color: BRAND.text }}
                  >
                    <path
                      fillRule="evenodd"
                      d="M12.9 14.32a8 8 0 111.414-1.414l3.39 3.39a1 1 0 01-1.414 1.415l-3.39-3.391zM14 8a6 6 0 11-12 0 6 6 0 0112 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              </label>

              <label className="flex flex-col">
                <span
                  className="text-sm mb-1"
                  style={{ color: `${BRAND.text}CC` }}
                >
                  Estado
                </span>
                <select
                  value={stateFilter}
                  onChange={(e) => {
                    setStateFilter(e.target.value);
                    setPage(1);
                  }}
                  className="rounded-xl border bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition focus:ring-2"
                  style={{ borderColor: BRAND.soft, color: BRAND.text }}
                >
                  <option value="all">Todos</option>
                  <option value="active">Activos</option>
                  <option value="inactive">Inactivos</option>
                </select>
              </label>
            </div>

            {/* Límite por página */}
            <label className="flex flex-col">
              <span
                className="text-sm mb-1"
                style={{ color: `${BRAND.text}CC` }}
              >
                Por página
              </span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="rounded-xl border bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition focus:ring-2 md:w-40"
                style={{ borderColor: BRAND.soft, color: BRAND.text }}
              >
                {[10, 20, 50].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* Errores */}
        {error && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
            {error}
          </div>
        )}

        {/* Tabla */}
        <NetworksTable items={items} loading={loading} onEdit={handleEdit} />

        {/* Paginación */}
        <Pagination
          page={page}
          perPage={limit}
          total={total}
          onPageChange={setPage}
        />
      </div>
    </section>
  );
}
