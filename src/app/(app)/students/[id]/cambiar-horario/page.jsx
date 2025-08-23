"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ScopeSwitcher } from "@/components/Schedule/ScopeSwitcher";
import { OccurrencePicker } from "@/components/Schedule/OccurrencePicker";
import CalendarSlotSelector from "@/components/Schedule/CalendarSlotSelector";
import {
  fetchEnrollmentsByStudent,
  saveCurrentMonthSlots,
  saveNextMonthSlots,
  rescheduleSingleClass,
} from "@/functions/request/schedule";

const BRAND = { main: "#A08775" };

// --- Utils de tiempo (TODO: si ya existen en utils/, reemplazar por import) ---
function nextYearMonth(y, m) {
  // m: 1..12 → devuelve { y, m } del siguiente mes
  const nm = m === 12 ? 1 : m + 1;
  const ny = m === 12 ? y + 1 : y;
  return { y: ny, m: nm };
}
function startOfMonthLocal(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}
function endOfMonthLocal(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}
function daysToEndOfMonth(date) {
  return Math.ceil((endOfMonthLocal(date) - date) / (1000 * 60 * 60 * 24));
}
function buildDateWindow(centerDate) {
  // Ventana ±7 días para reprogramar una clase puntual
  const start = new Date(centerDate);
  start.setDate(start.getDate() - 7);
  start.setHours(0, 0, 0, 0);
  const end = new Date(centerDate);
  end.setDate(end.getDate() + 7);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export default function ChangeSchedulePage() {
  const { id: studentId } = useParams();
  const router = useRouter();
  const { user, loading } = useAuth();

  const [mode, setMode] = useState("current"); // current | next | single
  const [enrollments, setEnrollments] = useState([]);
  const [professorId, setProfessorId] = useState(null);
  const [year, setYear] = useState(0);
  const [month, setMonth] = useState(0);
  const [initialSlots, setInitialSlots] = useState([]);
  const [chosenSlots, setChosenSlots] = useState([]);
  const [pickedOccurrence, setPickedOccurrence] = useState(null); // para single
  const [selection, setSelection] = useState({ professorId: null, slots: [] });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const canStudentEditNext = useMemo(
    () => user?.role === "student" && daysToEndOfMonth(new Date()) <= 5,
    [user]
  );

  // Carga inscripción/es del alumno
  useEffect(() => {
    if (!studentId) return;
    setError("");
    (async () => {
      try {
        const { enrollments } = await fetchEnrollmentsByStudent(studentId);
        setEnrollments(enrollments || []);
        const now = new Date();
        const y = now.getUTCFullYear();
        const m = now.getUTCMonth() + 1;
        const current =
          enrollments?.find((e) => e.year === y && e.month === m) ||
          enrollments?.[0];
        if (current) {
          setProfessorId(
            current.professor?._id || current.professor || current.profesor
          );
          setYear(current.year);
          setMonth(current.month);
          setInitialSlots(current.chosenSlots || current.slotsElegidos || []);
          setChosenSlots(current.chosenSlots || current.slotsElegidos || []);
        }
      } catch (e) {
        setError(e?.message || "No se pudo cargar");
      }
    })();
  }, [studentId]);

  useEffect(() => {
    if (user?.role === "student") setMode("next");
  }, [user]);

  const target = useMemo(() => {
    if (mode === "current") return { year, month };
    if (mode === "next") {
      const { y, m } = nextYearMonth(year, month);
      return { year: y, month: m };
    }
    return { year, month }; // single usa ventana ±7 días
  }, [mode, year, month]);

  const dateWindow = useMemo(
    () => (pickedOccurrence ? buildDateWindow(pickedOccurrence.date) : null),
    [pickedOccurrence]
  );

  const blockedMsg = useMemo(() => {
    if (user?.role !== "student") return "";
    if (mode === "current")
      return "Los alumnos no pueden editar el mes en curso. Pedile al admin.";
    if (mode === "next" && !canStudentEditNext)
      return "Los cambios para el mes que viene solo se permiten en los últimos 5 días del mes actual.";
    return "";
  }, [user, mode, canStudentEditNext]);

  const handleCalendarSelection = useCallback(
    ({ professorId, slots }) => {
      console.log(slots);

      // slots: [{ dayOfWeek, startMin, endMin }]
      if (mode !== "single" && slots.length > 2) {
        slots = slots.slice(0, 2); // por las dudas
      }

      setSelection({ professorId, slots });
      if (mode !== "single") setChosenSlots(slots);
    },
    [mode]
  );
  console.log(selection);

  async function handleSave() {
    try {
      setSaving(true);
      setError("");

      if (mode === "current") {
        const currentEnr = enrollments.find(
          (e) =>
            e.year === year &&
            e.month === month &&
            String(e.professor?._id || e.professor || e.profesor) ===
              String(professorId)
        );
        if (!currentEnr)
          throw new Error(
            "No se encontró la inscripción del mes actual para ese profesor."
          );

        await saveCurrentMonthSlots({
          enrollmentId: currentEnr._id,
          chosenSlots,
          professorId: selection.professorId,
        });
      } else if (mode === "next") {
        const { year: yy, month: mm } = target;
        await saveNextMonthSlots({
          studentId,
          professorId,
          year: yy,
          month: mm,
          chosenSlots,
          asStudent: user?.role === "student",
        });
      } else {
        // single
        if (!pickedOccurrence)
          throw new Error("Elegí primero qué clase querés reprogramar.");
        if (!selection.professorId || selection.slots.length !== 1)
          throw new Error("Elegí un único turno en el calendario.");

        const currentEnr = enrollments.find(
          (e) =>
            e.year === year &&
            e.month === month &&
            String(e.professor?._id || e.professor || e.profesor) ===
              String(professorId)
        );
        if (!currentEnr) throw new Error("No se encontró la inscripción.");

        const toSlot = selection.slots[0];
        await rescheduleSingleClass({
          enrollmentId: currentEnr._id,
          fromDateISO: pickedOccurrence.date.toISOString(),
          toProfessorId: selection.professorId,
          toSlot,
        });
      }

      // router.back();
    } catch (err) {
      console.error(err);
      setError(err?.message || "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main className="p-6">Cargando…</main>;

  return (
    <main className="p-6">
      <section className="max-w-5xl mx-auto space-y-6">
        <h1 className="text-2xl font-semibold">Cambiar horario</h1>

        {error && (
          <div className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg p-3">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3">
          <ScopeSwitcher
            value={mode}
            onChange={setMode}
            disabledNext={user?.role === "student" && !canStudentEditNext}
            disabledSingle={false}
          />
          <div className="ml-auto text-sm">
            Alumno ID:{" "}
            <span
              className="px-2 py-1 rounded"
              style={{ background: "#DDD7C9" }}
            >
              {String(studentId)}
            </span>
          </div>
        </div>

        {mode === "single" && (
          <OccurrencePicker
            enrollment={enrollments.find(
              (e) => e.year === year && e.month === month
            )}
            onPick={(o) => setPickedOccurrence(o)}
          />
        )}

        {blockedMsg && (
          <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
            {blockedMsg}
          </div>
        )}

        <CalendarSlotSelector
          professorId={professorId}
          year={mode === "single" ? year : target.year}
          month={mode === "single" ? month : target.month}
          initialSlots={
            mode === "current" || mode === "next" ? initialSlots : undefined
          }
          allowProfessorChange={mode !== "current"}
          dateWindow={mode === "single" && pickedOccurrence ? dateWindow : null}
          maxSlots={mode === "single" ? 1 : 2}
          onChange={handleCalendarSelection}
        />

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={
              saving ||
              (user?.role === "student" &&
                mode === "next" &&
                !canStudentEditNext) ||
              (mode === "single" && !pickedOccurrence)
            }
            className="px-4 py-2 rounded-xl text-white disabled:opacity-60"
            style={{ background: BRAND.main }}
          >
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 rounded-xl border"
          >
            Cancelar
          </button>
        </div>
      </section>
    </main>
  );
}
