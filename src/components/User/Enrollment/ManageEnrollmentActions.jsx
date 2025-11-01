"use client";
import { useMemo, useState } from "react";
import SlotPicker from "./SlotPicker";
import RescheduleSingleClass from "./RescheduleSingleClass";
import {
  updateEnrollmentSlots,
  upsertNextMonthEnrollment,
} from "@/functions/request/enrollments";
import { useParams } from "next/navigation";
import ClipLoader from "react-spinners/ClipLoader";

const BRAND = { main: "#A08775", soft: "#DDD7C9", text: "#1F1C19" };

function TabButton({ active, children, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition-all duration-150 ${
        active
          ? "bg-white shadow-sm border"
          : "bg-[rgba(221,215,201,0.3)] hover:bg-[rgba(221,215,201,0.6)] border"
      } ${
        disabled
          ? "cursor-not-allowed opacity-60"
          : "hover:scale-[1.03] active:scale-[0.98]"
      }`}
      style={{
        color: BRAND.text,
        borderColor: active ? BRAND.main : BRAND.soft,
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
  const [tab, setTab] = useState(""); // mes | siguiente | unica
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
        className="flex flex-wrap justify-center items-center gap-3 rounded-xl border p-2"
        style={{
          borderColor: BRAND.soft,
          background: `linear-gradient(180deg, ${BRAND.soft}33, transparent)`,
        }}
      >
        <TabButton active={tab === "mes"} onClick={() => setTab("mes")}>
          Cambiar horario (este mes)
        </TabButton>
        <TabButton active={tab === "unica"} onClick={() => setTab("unica")}>
          Reprogramar clase
        </TabButton>
        {tab !== "" && (
          <TabButton active={tab === ""} onClick={() => setTab("")}>
            Cerrar
          </TabButton>
        )}
      </div>

      {/* Error */}
      {!!error && <Notice kind="error">{error}</Notice>}

      {/* Loading spinner when fetching or saving */}
      {saving && (
        <div className="flex justify-center py-3">
          <ClipLoader color={BRAND.main} size={35} speedMultiplier={0.9} />
        </div>
      )}

      {/* Mes actual */}
      {!saving && tab === "mes" && (
        <div className="space-y-3 animate-fadeIn">
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
              className="rounded-xl px-5 py-2 text-sm font-semibold shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-60 hover:scale-[1.02] active:scale-[0.98]"
              style={{
                backgroundColor: BRAND.main,
                color: "#fff",
              }}
            >
              Guardar horario de este mes
            </button>
          </div>
        </div>
      )}

      {/* Reprogramación única */}
      {!saving && tab === "unica" && (
        <div className="space-y-3 animate-fadeIn">
          <RescheduleSingleClass enrollment={enrollment} onDone={onChanged} />
          <p className="text-xs" style={{ color: `${BRAND.text}99` }}>
            Recordá: la reprogramación individual suele estar limitada a 1 por
            mes.
          </p>
        </div>
      )}
    </div>
  );
}
