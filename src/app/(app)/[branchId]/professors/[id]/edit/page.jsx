"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  fetchProfessorById,
  updateProfessor,
  getProfessorMonthSchedule,
  updateProfessorSchedule,
  deleteProfessor,
} from "@/functions/request/professor";
import CalendarSlotProfessor from "@/components/Professors/CalendarSlotProfessor";
import { handleInputChange } from "@/functions/handleChanges";
import Swal from "sweetalert2";

function ymToMonthInputValue(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
function monthInputValueToParts(value) {
  const [y, m] = value.split("-").map(Number);
  return { y, m };
}

export default function EditProfessorPage() {
  const { id, branchId } = useParams();
  const router = useRouter();

  const BRAND = { main: "#A08775", soft: "#DDD7C9", text: "#1F1C19" };

  const [professor, setProfessor] = useState(null);
  const [capacity, setCapacity] = useState(10);
  const [applyFrom, setApplyFrom] = useState(ymToMonthInputValue(new Date()));
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProfessor() {
      try {
        const professorData = await fetchProfessorById(branchId, id);
        const { y, m } = monthInputValueToParts(applyFrom);
        const scheduleData = await getProfessorMonthSchedule(id, {
          year: y,
          month: m,
          branchId,
        });
        setProfessor(professorData.user);
        setCapacity(professorData.user.capacity || 10);
        setSchedule(scheduleData.schedule?.slots || []);
      } catch (e) {
        setError("Error al cargar los datos del profesor");
      } finally {
        setLoading(false);
      }
    }
    loadProfessor();
  }, [applyFrom, branchId, id]);

  async function handleSave() {
    try {
      setLoading(true);
      await updateProfessor(branchId, id, { professor });
      const { y, m } = monthInputValueToParts(applyFrom);
      await updateProfessorSchedule(branchId, id, {
        slots: schedule,
        applyFromYear: y,
        applyFromMonth: m,
      });
      // router.push(`/${branchId}/professors`);
    } catch (e) {
      setError("Error al guardar los cambios");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!id || !branchId) return;
    const result = await Swal.fire({
      title: "¿Eliminar profesor?",
      html: `
       <div style="text-align:left">
         <p>Esta acción <b>eliminará</b>:</p>
         <ul style="margin-left:1rem; list-style:disc;">
           <li>Sus horarios</li>
           <li>Todas sus inscripciones</li>
           <li>Reprogramaciones donde intervenga</li>
           <li>Asistencias relacionadas</li>
         </ul>
         <p class="mt-2">No se puede deshacer.</p>
       </div>
     `,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ef4444",
      reverseButtons: true,
      focusCancel: true,
    });

    if (!result.isConfirmed) return;

    try {
      const data = await deleteProfessor(branchId, professor._id);

      if (!data.ok)
        throw new Error(data?.error || "No se pudo eliminar el profesor");
      await Swal.fire({
        title: "Eliminado",
        text: "El profesor y sus datos relacionados fueron eliminados.",
        icon: "success",
        confirmButtonColor: "#16a34a",
      });
      router.push(`/${branchId}/professors`);
    } catch (e) {
      Swal.fire({
        title: "Error",
        text: e?.message || "No se pudo eliminar",
        icon: "error",
        confirmButtonColor: "#ef4444",
      });
    }
  }

  if (loading) {
    return (
      <main className="max-w-4xl mx-auto p-6">
        <div
          className="rounded-xl border px-3 py-2 text-sm"
          style={{
            color: BRAND.text,
            backgroundColor: `${BRAND.soft}66`,
            borderColor: BRAND.soft,
          }}
        >
          Cargando…
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="max-w-4xl mx-auto p-6">
        <div
          className="rounded-xl border px-3 py-2 text-sm"
          style={{
            color: "#991B1B",
            backgroundColor: "#FEF2F2",
            borderColor: "#FECACA",
          }}
        >
          {error}
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div
        className="rounded-2xl border px-4 py-3 sm:px-6"
        style={{
          borderColor: BRAND.soft,
          background: `linear-gradient(180deg, ${BRAND.soft}55, transparent)`,
        }}
      >
        <h1 className="text-2xl font-semibold" style={{ color: BRAND.text }}>
          Editar Profesor
        </h1>
        <p className="text-sm" style={{ color: `${BRAND.text}99` }}>
          Modificá los datos del profesor y sus horarios.
        </p>
      </div>

      {/* Datos del profesor */}
      <section
        className="space-y-4 rounded-2xl border p-4 sm:p-6"
        style={{ borderColor: BRAND.soft, background: "#fff" }}
      >
        <div>
          <label
            className="block text-sm font-medium mb-1"
            style={{ color: `${BRAND.text}CC` }}
          >
            Nombre
          </label>
          <input
            type="text"
            name="name"
            onChange={(e) => handleInputChange(e, setProfessor)}
            value={professor.name}
            className="mt-1 block w-full rounded-xl border bg-white/90 px-3 py-2 shadow-sm outline-none transition focus:ring-2"
            style={{ borderColor: BRAND.soft, color: BRAND.text }}
          />
        </div>

        <div>
          <label
            className="block text-sm font-medium mb-1"
            style={{ color: `${BRAND.text}CC` }}
          >
            Email
          </label>
          <input
            type="email"
            name="email"
            value={professor.email}
            onChange={(e) => handleInputChange(e, setProfessor)}
            className="mt-1 block w-full rounded-xl border bg-white/90 px-3 py-2 shadow-sm outline-none transition focus:ring-2"
            style={{ borderColor: BRAND.soft, color: BRAND.text }}
          />
        </div>

        <div>
          <label
            className="block text-sm font-medium mb-1"
            style={{ color: `${BRAND.text}CC` }}
          >
            Contraseña
          </label>
          <input
            type="text"
            name="password"
            value={professor.password || ""}
            onChange={(e) => handleInputChange(e, setProfessor)}
            className="mt-1 block w-full rounded-xl border bg-white/90 px-3 py-2 shadow-sm outline-none transition focus:ring-2"
            style={{ borderColor: BRAND.soft, color: BRAND.text }}
            placeholder="Dejar vacío para no cambiar"
          />
        </div>

        <div>
          <label
            className="block text-sm font-medium mb-1"
            style={{ color: `${BRAND.text}CC` }}
          >
            Capacidad por clase
          </label>
          <input
            type="number"
            name="capacity"
            value={professor.capacity}
            onChange={(e) => handleInputChange(e, setProfessor)}
            className="mt-1 block w-full rounded-xl border bg-white/90 px-3 py-2 shadow-sm outline-none transition focus:ring-2"
            style={{ borderColor: BRAND.soft, color: BRAND.text }}
          />
        </div>
      </section>

      {/* Configuración de horarios */}
      <section
        className="space-y-4 rounded-2xl border p-4 sm:p-6"
        style={{ borderColor: BRAND.soft, background: "#fff" }}
      >
        <div>
          <label
            className="block text-sm font-medium mb-1"
            style={{ color: `${BRAND.text}CC` }}
          >
            Aplicar cambios de horario desde
          </label>
          <input
            type="month"
            value={applyFrom}
            onChange={(e) => setApplyFrom(e.target.value)}
            className="w-full rounded-xl border bg-white/90 px-3 py-2 shadow-sm outline-none transition focus:ring-2"
            style={{ borderColor: BRAND.soft, color: BRAND.text }}
          />
        </div>

        <div className="space-y-2">
          <label
            className="block text-sm font-medium"
            style={{ color: BRAND.text }}
          >
            Horarios
          </label>
          <div
            className="rounded-2xl border p-3 sm:p-4"
            style={{ borderColor: BRAND.soft }}
          >
            <CalendarSlotProfessor slots={schedule} onChange={setSchedule} />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="flex justify-end gap-3">
        <button
          onClick={() =>
            router.push(`/${branchId}/professors/${id}/adhoc-classes/${professor.name}`)
          }
          className="rounded-xl px-4 py-2 font-semibold shadow-sm transition hover:brightness-95"
          style={{ background: "#3B82F6", color: "#fff" }}
        >
          Cargar clases ad-hoc
        </button>
        <button
          onClick={handleDelete}
          className="rounded-xl px-4 py-2 font-semibold shadow-sm transition hover:brightness-95"
          style={{
            background: "#ef4444",
            color: "#fff",
            border: "1px solid #ef4444",
          }}
        >
          Eliminar profesor
        </button>
        <button
          onClick={() => router.push(`/${branchId}/professors`)}
          className="rounded-xl border px-4 py-2 font-medium transition hover:shadow-sm"
          style={{
            borderColor: BRAND.soft,
            color: BRAND.text,
            background: "#fff",
          }}
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          className="rounded-xl px-4 py-2 font-semibold shadow-sm transition hover:brightness-95"
          style={{ background: BRAND.main, color: "#fff" }}
        >
          Guardar
        </button>
      </footer>
    </main>
  );
}
