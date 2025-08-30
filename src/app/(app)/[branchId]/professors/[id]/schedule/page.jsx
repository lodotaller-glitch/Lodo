"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import CalendarSlotSelector from "@/components/Schedule/CalendarSlotSelector";
import {
  getProfessorMonthSchedule,
  updateProfessorMonthSchedule,
} from "@/functions/request/professor";

function nextYearMonth(y, m) {
  const nm = m === 12 ? 1 : m + 1;
  const ny = m === 12 ? y + 1 : y;
  return { y: ny, m: nm };
}

export default function ProfessorSchedulePage() {
  const { branchId, id: professorId } = useParams();
  const now = new Date();
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const [initial, setInitial] = useState([]);
  const [selection, setSelection] = useState({ professorId: null, slots: [] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  useEffect(() => {
    (async () => {
      setError("");
      setOk("");
      const { schedule } = await getProfessorMonthSchedule(professorId, {
        year,
        month,
        branchId,
      });
      setInitial(schedule?.slots || []);
    })();
  }, [professorId, year, month]);

  const target = useMemo(() => ({ year, month }), [year, month]);

  async function handleSave() {
    try {
      setSaving(true);
      setError("");
      setOk("");
      const newSlots = selection.slots.length ? selection.slots : initial;
      const { ok, reassigned } = await updateProfessorMonthSchedule(
        professorId,
        { year: target.year, month: target.month, newSlots }
      );
      setOk(`Saved. Reassigned enrollments: ${reassigned}`);
    } catch (e) {
      setError(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="p-6 max-w-5xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">Professor Schedule</h1>
      {error && (
        <div className="text-sm text-red-700 bg-red-50 border p-2">{error}</div>
      )}
      {ok && (
        <div className="text-sm text-green-700 bg-green-50 border p-2">
          {ok}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          className="px-2 py-1 border rounded"
          onClick={() => setMonth((m) => (m === 1 ? 12 : m - 1))}
        >
          Prev Month
        </button>
        <div className="text-sm">
          {year}-{String(month).padStart(2, "0")}
        </div>
        <button
          className="px-2 py-1 border rounded"
          onClick={() => setMonth((m) => (m === 12 ? 1 : m + 1))}
        >
          Next Month
        </button>
      </div>

      <CalendarSlotSelector
        professorId={professorId}
        year={target.year}
        month={target.month}
        initialSlots={initial}
        allowProfessorChange={false}
        dateWindow={null}
        maxSlots={2}
        onChange={({ professorId, slots }) =>
          setSelection({ professorId, slots })
        }
      />

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          className="px-4 py-2 rounded bg-black text-white"
          disabled={saving}
        >
          Save changes
        </button>
      </div>
    </main>
  );
}
