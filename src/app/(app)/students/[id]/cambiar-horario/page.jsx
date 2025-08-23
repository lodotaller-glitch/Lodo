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

function nextYearMonth(y, m) {
  return m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 };
}
function endOfMonthLocal(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}
function daysToEndOfMonth(date) {
  return Math.ceil((endOfMonthLocal(date) - date) / (1000 * 60 * 60 * 24));
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

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!studentId) return;
    fetchEnrollmentsByStudent(studentId)
      .then(({ enrollments }) => {
        setEnrollments(enrollments || []);
        const now = new Date();
        const y = now.getUTCFullYear(),
          m = now.getUTCMonth() + 1;
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
      })
      .catch((e) => setError(e?.message || "No se pudo cargar"));
  }, [studentId]);

  useEffect(() => {
    if (user?.role === "student") setMode("next");
  }, [user]);

  const target = useMemo(() => {
    if (mode === "current") return { year, month };
    if (mode === "next") return nextYearMonth(year, month);
    return { year, month }; // single usa ventana ±7 días
  }, [mode, year, month]);

  const dateWindow = useMemo(() => {
    if (!pickedOccurrence) return null;
    const from = pickedOccurrence.date;
    const ms = 7 * 24 * 60 * 60 * 1000;
    return {
      start: new Date(from.getTime() - ms),
      end: new Date(from.getTime() + ms),
    };
  }, [pickedOccurrence]);

  const handleCalendarSelection = useCallback(
    ({ professorId: pId, slots }) => {
      console.log("handleCalendarSelection", pId, slots);
      
      setProfessorId(pId || professorId);
      setChosenSlots(
        slots.map(({ dayOfWeek, startMin, endMin }) => ({
          dayOfWeek,
          startMin,
          endMin,
        }))
      );
      setSelection({ professorId: pId, slots });
    },
    [professorId]
  );

  console.log(professorId, "selected professor");
  
  async function handleSave() {
    
    try {
      setSaving(true);
      setError("");
      if (mode === "current") {
        console.log(enrollments);
        console.log(String(professorId), "professorId");
        
        const currentEnr = enrollments.find(
          (e) =>
            e.year === year &&
          // e.month === month 
          // &&
          String(e.professor?._id) ===
          String(professorId)
        );
        console.log(enrollments, "enrollments");
        console.log(currentEnr, "currentEnr");
        
        if (!currentEnr)
          throw new Error(
        "No se encontró la inscripción del mes actual para ese profesor."
      );
      console.log("Saving current month slots", currentEnr._id, chosenSlots);
      
        await saveCurrentMonthSlots({
          enrollmentId: currentEnr._id,
          chosenSlots,
        });
      } else if (mode === "next") {
        if (user.role === "student" && !canStudentEditNext)
          throw new Error(
            "Como estudiante, solo podés cambiar el mes siguiente dentro de los últimos 5 días del mes actual."
          );
        const { year: yy, month: mm } = target;
        await saveNextMonthSlots({
          studentId,
          professorId,
          year: yy,
          month: mm,
          chosenSlots,
          asStudent: user.role === "student",
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
        // Podés mandar toDateISO=null si lo determina el backend desde slot+ventana; aquí enviamos el mismo day/time del evento clickeado
        await rescheduleSingleClass({
          enrollmentId: currentEnr._id,
          fromDateISO: pickedOccurrence.date.toISOString(),
          toProfessorId: selection.professorId,
          toSlot,
          toDateISO: null, // el backend puede validarlo dentro de ±7 días; si requerís fecha exacta, guardala al hacer click
          motivo: "Reprogramación desde panel",
        });
      }
      // router.back();
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  const blockedMsg = useMemo(() => {
    if (user?.role !== "student") return null;
    if (mode === "next" && !canStudentEditNext)
      return "Como estudiante, solo podés cambiar el mes siguiente en los últimos 5 días del mes actual.";
    if (mode === "single")
      return "Como estudiante, solo podés reprogramar 1 clase por mes (el backend lo valida).";
    return null;
  }, [user, mode, canStudentEditNext]);

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Cambiar horario</h1>
        <button
          onClick={() => router.back()}
          className="px-3 py-2 rounded-xl border"
        >
          Volver
        </button>
      </header>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          {error}
        </div>
      )}

      <section className="bg-white rounded-2xl shadow p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm">Alcance:</span>
          <ScopeSwitcher
            value={mode}
            onChange={setMode}
            disabledNext={
              false /* el backend decide si rechaza según rol/fecha */
            }
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
          year={
            mode === "single"
              ? year
              : mode === "next"
              ? nextYearMonth(year, month).y
              : year
          }
          month={
            mode === "single"
              ? month
              : mode === "next"
              ? nextYearMonth(year, month).m
              : month
          }
          initialSlots={
            mode === "current" || mode === "next" ? initialSlots : []
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
