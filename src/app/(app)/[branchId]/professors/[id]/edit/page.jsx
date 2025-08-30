"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  fetchProfessorById,
  updateProfessor,
  getProfessorMonthSchedule,
  updateProfessorSchedule,
} from "@/functions/request/professor";
import CalendarSlotProfessor from "@/components/Professors/CalendarSlotProfessor";
import { handleInputChange } from "@/Functions/handleChanges";

export default function EditProfessorPage() {
  const { id, branchId } = useParams();
  const router = useRouter();

  const [professor, setProfessor] = useState(null);
  const [capacity, setCapacity] = useState(10);
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProfessor() {
      try {
        const professorData = await fetchProfessorById(branchId, id);
        const scheduleData = await getProfessorMonthSchedule(id, {
          year: new Date().getFullYear(),
          month: new Date().getMonth() + 1,
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
  }, [branchId, id]);

  async function handleSave() {
    try {
      setLoading(true);
      await updateProfessor(branchId, id, { professor });
      await updateProfessorSchedule(branchId, id, { slots: schedule });
      // router.push(`/${branchId}/professors`);
    } catch (e) {
      setError("Error al guardar los cambios");
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <p>Cargando...</p>;
  if (error) return <p>{error}</p>;

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Editar Profesor</h1>
        <p className="text-sm text-gray-600">
          Modifica los datos del profesor y sus horarios.
        </p>
      </header>

      <section className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Nombre
          </label>
          <input
            type="text"
            name="name"
            onChange={(e) => handleInputChange(e, setProfessor)}
            value={professor.name}
            className="mt-1 block w-full border rounded-lg px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            type="email"
            name="email"
            value={professor.email}
            onChange={(e) => handleInputChange(e, setProfessor)}
            className="mt-1 block w-full border rounded-lg px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Capacidad por clase
          </label>
          <input
            type="number"
            name="capacity"
            value={capacity}
            onChange={(e) => handleInputChange(e, setProfessor)}
            className="mt-1 block w-full border rounded-lg px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Horarios
          </label>
          <CalendarSlotProfessor slots={schedule} onChange={setSchedule} />
        </div>
      </section>

      <footer className="flex justify-end gap-4">
        <button
          onClick={() => router.push(`/${branchId}/professors`)}
          className="px-4 py-2 rounded-lg bg-gray-200"
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white"
        >
          Guardar
        </button>
      </footer>
    </main>
  );
}
