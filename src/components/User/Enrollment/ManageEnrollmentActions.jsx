"use client";
import { useMemo, useState } from "react";
import SlotPicker from "./SlotPicker";
import RescheduleSingleClass from "./RescheduleSingleClass";
import {
  updateEnrollmentSlots,
  upsertNextMonthEnrollment,
} from "@/functions/request/enrollments";
import { useParams } from "next/navigation";

export default function ManageEnrollmentActions({ enrollment, onChanged }) {
  const [tab, setTab] = useState("mes"); // mes | siguiente | unica
  const [slotsMes, setSlotsMes] = useState(enrollment.chosenSlots || []);
  const [slotsNext, setSlotsNext] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const yearNext = useMemo(
    () => (enrollment.month === 12 ? enrollment.year + 1 : enrollment.year),
    [enrollment.year, enrollment.month]
  );
  const monthNext = useMemo(
    () => (enrollment.month === 12 ? 1 : enrollment.month + 1),
    [enrollment.month]
  );

  const { branchId } = useParams();

  console.log(enrollment);
  console.log(slotsMes);

  async function saveMes() {
    console.log("hola");

    setSaving(true);
    setError("");
    try {
      console.log("Saving current month slots", slotsMes);
      console.log(enrollment._id);

      await updateEnrollmentSlots(
        enrollment._id,
        slotsMes,
        enrollment.assigned,
        branchId
      );
      onChanged?.();
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || "Error");
    } finally {
      setSaving(false);
    }
  }

  async function saveNext() {
    setSaving(true);
    setError("");
    try {
      await upsertNextMonthEnrollment({
        studentId: enrollment.student,
        professorId: enrollment.professor._id,
        year: yearNext,
        month: monthNext,
        chosenSlots: slotsNext,
        assignNow: false,
        branchId,
      });
      onChanged?.();
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || "Error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          onClick={() => setTab("mes")}
          className={`px-3 py-1.5 rounded-xl border ${
            tab === "mes" ? "bg-white" : ""
          }`}
        >
          Cambiar horario (este mes)
        </button>
        <button
          onClick={() => setTab("siguiente")}
          className={`px-3 py-1.5 rounded-xl border ${
            tab === "siguiente" ? "bg-white" : ""
          }`}
        >
          Cambiar horario (mes siguiente)
        </button>
        <button
          onClick={() => setTab("unica")}
          className={`px-3 py-1.5 rounded-xl border ${
            tab === "unica" ? "bg-white" : ""
          }`}
        >
          Reprogramar 1 clase
        </button>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      {tab === "mes" && (
        <div className="space-y-2">
          <SlotPicker
            professorId={enrollment.professor._id}
            year={enrollment.year}
            month={enrollment.month}
            value={slotsMes}
            onChange={setSlotsMes}
          />
          <button
            onClick={saveMes}
            disabled={saving}
            className="px-4 py-2 rounded-xl text-white"
            style={{ background: "#A08775" }}
          >
            {saving ? "Guardando…" : "Guardar horario de este mes"}
          </button>
        </div>
      )}

      {tab === "siguiente" && (
        <div className="space-y-2">
          <SlotPicker
            professorId={enrollment.professor._id}
            year={yearNext}
            month={monthNext}
            value={slotsNext}
            onChange={setSlotsNext}
          />
          <button
            onClick={saveNext}
            disabled={saving}
            className="px-4 py-2 rounded-xl text-white"
            style={{ background: "#A08775" }}
          >
            {saving ? "Guardando…" : "Guardar horario del mes siguiente"}
          </button>
        </div>
      )}

      {tab === "unica" && (
        <RescheduleSingleClass enrollment={enrollment} onDone={onChanged} />
      )}
    </div>
  );
}
