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
    router.push(`/${branchId}/students/new`);
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
          <button
            onClick={handleCreateplus}
            className="px-4 py-2 rounded-xl text-white"
            style={{ background: BRAND.main }}
          >
            + Crear muchos estudiantes
          </button>
        </div>
      </header>

      <div className="bg-white rounded-2xl shadow p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3 md:items-end md:justify-between">
          <div className="flex flex-1 gap-3">
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
            <label className="w-48 flex flex-col">
              <span className="text-sm text-gray-600 mb-1">Estado</span>
              <select
                value={stateFilter}
                onChange={(e) => {
                  setStateFilter(e.target.value);
                  setPage(1);
                }}
                className="border rounded-lg px-3 py-2"
              >
                <option value="all">Todos</option>
                <option value="active">Activos</option>
                <option value="inactive">Inactivos</option>
              </select>
            </label>
          </div>
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
