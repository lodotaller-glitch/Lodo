"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Pagination from "@/components/Common/Pagination";
import { fetchBranchProfessors } from "@/functions/request/professor";

const BRAND = { main: "#A08775", soft: "#DDD7C9", text: "#1F1C19" };

export default function ProfessorsList() {
  const router = useRouter();
  const { branchId } = useParams();

  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const params = useMemo(
    () => ({ q, page, limit, branch: branchId }),
    [q, page, limit, branchId]
  );

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const data = await fetchBranchProfessors(params);
        if (!alive) return;
        setItems(data.professors || []);
        setTotal(data.total || 0);
      } catch (e) {
        if (!alive) return;
        setError(e?.message || "Error al cargar");
        setItems([]);
        setTotal(0);
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [params]);

  function handleCreate() {
    router.push(`/${branchId}/professors/new`);
  }

  return (
    <section className="space-y-4">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Profesores</h1>
          <p className="text-sm text-gray-600">
            Listado de profesores. Podés entrar a cada uno para editarlo.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleCreate}
            className="px-4 py-2 rounded-xl text-white"
            style={{ background: BRAND.main }}
          >
            + Crear profesor
          </button>
        </div>
      </header>

      <div className="bg-white rounded-2xl shadow p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3 md:items-end md:justify-between">
          <label className="flex-1 flex flex-col">
            <span className="text-sm text-gray-600 mb-1">Buscar</span>
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Nombre o email"
              className="border rounded-lg px-3 py-2"
            />
          </label>
          <label className="w-28 flex flex-col">
            <span className="text-sm text-gray-600 mb-1">Por página</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="border rounded-lg px-3 py-2"
            >
              {[10, 20, 50].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
            {error}
          </div>
        )}

        <ul className="divide-y">
          {loading ? (
            <li>Cargando...</li>
          ) : (
            items.map((p) => (
              <li
                key={p._id}
                className="py-3 grid grid-cols-4 items-center gap-3"
              >
                <div className="col-span-2">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-sm text-gray-500">{p.email}</div>
                </div>
                <div className="text-sm">Capacidad: {p.capacity ?? 10}</div>
                <div className="ml-auto flex gap-3 justify-end">
                  <button
                    onClick={() =>
                      router.push(`/${branchId}/professors/${p._id}/edit`)
                    }
                    className="text-blue-600"
                  >
                    Editar
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>

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
