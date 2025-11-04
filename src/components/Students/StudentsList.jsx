"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import StudentsTable from "@/components/Students/StudentsTable";
import Pagination from "@/components/Common/Pagination";
import { fetchStudents } from "@/functions/request/students";
import { useAuth } from "@/context/AuthContext";

const BRAND = { main: "#A08775", soft: "#DDD7C9", text: "#1F1C19" };

export default function StudentsList({ professor = false }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [stateFilter, setStateFilter] = useState("all"); // all|active|inactive
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [branchId, setBranchId] = useState(null);

  const { user } = useAuth();
  const searchParams = useParams(); // hook siempre

  // const branchId = professor ? user?.branch : searchParams?.branchId;

  useEffect(() => {
    setBranchId(professor ? user?.branch : searchParams?.branchId);
  }, [user]);

  const params = useMemo(
    () => ({ q, page, limit, state: stateFilter, branch: branchId }),
    [q, page, limit, stateFilter, branchId]
  );

  useEffect(() => {
    if (!branchId) return;
    let alive = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const data = await fetchStudents(params);
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
    }
    load();
    return () => {
      alive = false;
    };
  }, [params, branchId]);

  function handleCreate() {
    !professor
      ? router.push(`/${branchId}/students/new`)
      : router.push(`/professor/students/new`);
  }
  function handleCreateplus() {
    router.push(`/${branchId}/students/bulk`);
  }
  function handleEdit(id) {
    !professor
      ? router.push(`/${branchId}/students/${id}/edit`)
      : router.push(`/professor/students/${id}/edit`);
  }

  return (
    <section className="space-y-4">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Estudiantes</h1>
          <p className="text-sm text-gray-600">
            Listado de alumnos. Podés entrar a cada uno para editarlo.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleCreate}
            className="px-4 py-2 rounded-xl text-white"
            style={{ background: BRAND.main }}
          >
            + Crear estudiante
          </button>
          {!professor ? (
            <button
              onClick={handleCreateplus}
              className="px-4 py-2 rounded-xl text-white"
              style={{ background: BRAND.main }}
            >
              + Crear muchos estudiantes
            </button>
          ) : null}
        </div>
      </header>

      <div className="bg-white rounded-2xl shadow p-4 space-y-3">
        <div
          className="rounded-2xl border p-4 sm:p-5 shadow-sm"
          style={{
            borderColor: BRAND?.soft,
            background: `linear-gradient(180deg, ${
              BRAND?.soft ?? "#EEE"
            }55, #ffffff)`,
          }}
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            {/* Búsqueda + Estado (grid en mobile, fila en desktop) */}
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="sm:col-span-2 flex flex-col">
                <span
                  className="text-sm mb-1"
                  style={{ color: `${BRAND?.text ?? "#111"}CC` }}
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
                    style={{ borderColor: BRAND?.soft, color: BRAND?.text }}
                  />
                  <svg
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-60"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    style={{ color: BRAND?.text }}
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
                  style={{ color: `${BRAND?.text ?? "#111"}CC` }}
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
                  style={{ borderColor: BRAND?.soft, color: BRAND?.text }}
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
                style={{ color: `${BRAND?.text ?? "#111"}CC` }}
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
                style={{ borderColor: BRAND?.soft, color: BRAND?.text }}
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

        {error && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
            {error}
          </div>
        )}

        <StudentsTable items={items} loading={loading} onEdit={handleEdit} />

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
