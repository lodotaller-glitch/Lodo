"use client";
import { useMemo, useState } from "react";
import SlotPicker from "./SlotPicker";
import RescheduleSingleClass from "./RescheduleSingleClass";
import {
  updateEnrollmentSlots,
  upsertNextMonthEnrollment,
} from "@/functions/request/enrollments";
import { useParams } from "next/navigation";

const BRAND = { main: "#A08775", soft: "#DDD7C9", text: "#1F1C19" };

function TabButton({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl px-3 py-1.5 text-sm font-medium transition"
      style={{
        backgroundColor: active ? "#fff" : `${BRAND.soft}55`,
        color: BRAND.text,
        border: `1px solid ${active ? BRAND.main : BRAND.soft}`,
        boxShadow: active ? "0 1px 2px rgba(0,0,0,.06)" : undefined,
      }}
    >
      {children}
    </button>
  );
}

function Notice({ kind = "info", children }) {
  const styles = {
    success: { fg: "#166534", bg: "#ECFDF5", br: "#86EFAC" },
    error: { fg: "#991B1B", bg: "#FEF2F2", br: "#FECACA" },
    info: { fg: BRAND.text, bg: `${BRAND.soft}66`, br: BRAND.soft },
  }[kind];
  return (
    <div
      role="alert"
      className="rounded-xl border px-3 py-2 text-sm"
      style={{
        color: styles.fg,
        backgroundColor: styles.bg,
        borderColor: styles.br,
      }}
    >
      {children}
    </div>
  );
}

export default function ManageEnrollmentActions({
  enrollment,
  onChanged,
  branchId: branchIdProp,
}) {
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

  const params = useParams();

  const branchId = branchIdProp || params?.branchId;

  async function saveMes() {
    setSaving(true);
    setError("");
    try {
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
        professorId: enrollment.professor?._id || enrollment.professor,
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
    <div
      className="space-y-4 rounded-2xl border p-4 sm:p-5"
      style={{ borderColor: BRAND.soft }}
    >
      {/* Tabs */}
      <div
        className="flex flex-wrap items-center gap-2 rounded-xl border p-1.5"
        style={{
          borderColor: BRAND.soft,
          background: `linear-gradient(180deg, ${BRAND.soft}55, transparent)`,
        }}
      >
        <TabButton active={tab === "mes"} onClick={() => setTab("mes")}>
          Cambiar horario (este mes)
        </TabButton>
        <TabButton
          active={tab === "siguiente"}
          onClick={() => setTab("siguiente")}
        >
          Cambiar horario (mes siguiente)
        </TabButton>
        <TabButton active={tab === "unica"} onClick={() => setTab("unica")}>
          Reprogramar 1 clase
        </TabButton>
      </div>

      {/* Error */}
      {!!error && <Notice kind="error">{error}</Notice>}

      {/* Mes actual */}
      {tab === "mes" && (
        <div className="space-y-3">
          <SlotPicker
            professorId={enrollment.professor?._id || enrollment.professor}
            year={enrollment.year}
            month={enrollment.month}
            value={slotsMes}
            onChange={setSlotsMes}
            branchId={branchId}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: `${BRAND.text}99` }}>
              Seleccionados:{" "}
              <b style={{ color: BRAND.text }}>{slotsMes.length}</b>
            </span>
            <button
              onClick={saveMes}
              disabled={saving}
              className="rounded-xl px-4 py-2 text-sm font-medium shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60"
              style={{ backgroundColor: BRAND.main, color: "#fff" }}
            >
              {saving ? "Guardando…" : "Guardar horario de este mes"}
            </button>
          </div>
        </div>
      )}

      {/* Mes siguiente */}
      {tab === "siguiente" && (
        <div className="space-y-3">
          <SlotPicker
            professorId={enrollment.professor?._id || enrollment.professor}
            year={yearNext}
            month={monthNext}
            value={slotsNext}
            onChange={setSlotsNext}
            branchId={branchId}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: `${BRAND.text}99` }}>
              Seleccionados:{" "}
              <b style={{ color: BRAND.text }}>{slotsNext.length}</b>
            </span>
            <button
              onClick={saveNext}
              disabled={saving}
              className="rounded-xl px-4 py-2 text-sm font-medium shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60"
              style={{ backgroundColor: BRAND.main, color: "#fff" }}
            >
              {saving ? "Guardando…" : "Guardar horario del mes siguiente"}
            </button>
          </div>
        </div>
      )}

      {/* Reprogramación única */}
      {tab === "unica" && (
        <div className="space-y-3">
          <RescheduleSingleClass
            enrollment={enrollment}
            onDone={onChanged}
          />
          <p className="text-xs" style={{ color: `${BRAND.text}99` }}>
            Recordá: la reprogramación individual suele estar limitada a 1 por
            mes.
          </p>
        </div>
      )}
    </div>
  );
}
