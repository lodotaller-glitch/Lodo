"use client";

import { useEffect, useState } from "react";
import Swal from "sweetalert2";

const { default: api } = require("@/lib/axios");

const BRAND = { main: "#A08775", soft: "#DDD7C9", text: "#1F1C19" };
const DOW = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function ymToMonthInputValue(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
function monthInputValueToParts(value) {
  const [y, m] = value.split("-").map(Number);
  return { y, m };
}
function minutesFromUTCDate(d) {
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

export function NewEnrollmentInline({ branchId, studentId, onCreated }) {
  const [open, setOpen] = useState(false);
  const [professors, setProfessors] = useState([]);
  const [professorId, setProfessorId] = useState("");
  const [monthStr, setMonthStr] = useState(ymToMonthInputValue(new Date()));
  const [slots, setSlots] = useState([]);
  const [slotKey, setSlotKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    api
      .get(`/${branchId}/professors`)
      .then(({ data }) => setProfessors(data.professors || []))
      .catch(() => setProfessors([]));
  }, [open, branchId]);

  async function loadSlots() {
    setErr("");
    setSlots([]);
    if (!professorId || !monthStr) return;
    try {
      setLoading(true);
      const { y, m } = monthInputValueToParts(monthStr);
      const url = new URL(`/api/calendar/professor`, window.location.origin);
      url.searchParams.set("professorId", professorId);
      url.searchParams.set("year", String(y));
      url.searchParams.set("month", String(m));
      const { data } = await api.get(url.toString());

      if (!data?.events.length)
        throw new Error(data?.error || "No se pudo cargar el calendario");

      // Unificar por slotKey (una franja por semana)
      const map = new Map();
      for (const ev of data.events || []) {
        if (!map.has(ev.slotKey)) {
          map.set(ev.slotKey, {
            slotKey: ev.slotKey,
            weekday: ev.weekday,
            startISO: ev.start,
            endISO: ev.end,
            capacityLeft: ev.capacityLeft,
            status: ev.status,
          });
        }
      }
      const arr = [...map.values()].sort(
        (a, b) =>
          a.weekday - b.weekday || new Date(a.startISO) - new Date(b.startISO)
      );
      setSlots(arr);
      setSlotKey(arr[0]?.slotKey || "");
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function createEnrollment() {
    try {
      if (!professorId || !monthStr || !slotKey) {
        throw new Error("Completá profesor, mes y franja");
      }
      setSaving(true);
      const { y, m } = monthInputValueToParts(monthStr);
      const picked = slots.find((s) => s.slotKey === slotKey);
      const startMin = minutesFromUTCDate(new Date(picked.startISO));
      const endMin = minutesFromUTCDate(new Date(picked.endISO));

      const { data } = await api.post(`/${branchId}/enrollments`, {
        studentId,
        professorId,
        year: y,
        month: m,
        slotKey,
        chosenSlots: [{ dayOfWeek: picked.weekday, startMin, endMin }],
        assignNow: true,
      });
      if (!data.ok)
        throw new Error(data?.error || "No se pudo crear la inscripción");
      setOpen(false);
      onCreated?.();
      const res = await Swal.fire({
        title: "Inscripción creada",
        icon: "success",
        confirmButtonText: "OK",
        confirmButtonColor: BRAND.main,
        allowOutsideClick: false,
        allowEscapeKey: false,
      });
      if (res.isConfirmed) {
        window.location.reload(); // ahora sí, luego del OK
      }
    } catch (e) {
      Swal.fire({
        title: "Error",
        text: e.message,
        icon: "error",
        confirmButtonColor: BRAND.main,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="rounded-2xl border-2 p-4 sm:p-5"
      style={{ borderColor: BRAND.main }}
    >
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition hover:brightness-95"
          style={{ backgroundColor: BRAND.main, color: "#fff" }}
        >
          Nueva inscripción
        </button>
      ) : (
        <div className="space-y-4">
          {/* Filtros */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="flex flex-col">
              <span
                className="mb-1 text-xs font-medium"
                style={{ color: `${BRAND.text}CC` }}
              >
                Profesor
              </span>
              <select
                className="rounded-xl border bg-white/90 px-3 py-2 shadow-sm outline-none transition focus:ring-2"
                style={{ borderColor: BRAND.soft, color: BRAND.text }}
                value={professorId}
                onChange={(e) => setProfessorId(e.target.value)}
              >
                <option value="">— Elegir —</option>
                {professors.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col">
              <span
                className="mb-1 text-xs font-medium"
                style={{ color: `${BRAND.text}CC` }}
              >
                Mes
              </span>
              <input
                type="month"
                className="rounded-xl border bg-white/90 px-3 py-2 shadow-sm outline-none transition focus:ring-2"
                style={{ borderColor: BRAND.soft, color: BRAND.text }}
                value={monthStr}
                onChange={(e) => setMonthStr(e.target.value)}
              />
            </label>

            <div className="flex items-end">
              <button
                type="button"
                onClick={loadSlots}
                className="w-full rounded-xl border px-4 py-2 text-sm font-medium transition hover:shadow-sm"
                style={{
                  borderColor: BRAND.main,
                  color: BRAND.text,
                  background: `${BRAND.soft}55`,
                }}
              >
                Ver franjas
              </button>
            </div>
          </div>

          {/* Estado de carga / error */}
          {loading && (
            <div
              className="rounded-xl border px-3 py-2 text-sm inline-block"
              style={{
                color: BRAND.text,
                backgroundColor: `${BRAND.soft}66`,
                borderColor: BRAND.soft,
              }}
            >
              Cargando franjas…
            </div>
          )}
          {err && (
            <div
              className="rounded-xl border px-3 py-2 text-sm"
              style={{
                color: "#991B1B",
                backgroundColor: "#FEF2F2",
                borderColor: "#FECACA",
              }}
            >
              {err}
            </div>
          )}

          {/* Radios de franjas */}
          {slots.length > 0 && (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {slots.map((s) => {
                const active = slotKey === s.slotKey;
                const start = new Date(s.startISO);
                const end = new Date(s.endISO);
                const timeFmt = (d) =>
                  d.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                return (
                  <label
                    key={s.slotKey}
                    className={`flex items-center gap-3 rounded-2xl border px-3 py-2 shadow-sm transition hover:shadow ${
                      active ? "text-white" : ""
                    }`}
                    style={{
                      borderColor: active ? BRAND.main : BRAND.soft,
                      background: active ? BRAND.main : "#fff",
                    }}
                  >
                    <input
                      type="radio"
                      name="slot-new"
                      value={s.slotKey}
                      checked={active}
                      onChange={() => setSlotKey(s.slotKey)}
                      className="h-4 w-4"
                      style={{ accentColor: active ? "#fff" : BRAND.main }}
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-medium">
                        {DOW[s.weekday]} {timeFmt(start)} — {timeFmt(end)}
                      </div>
                      <div
                        className="text-xs"
                        style={{ color: active ? "#fff" : `${BRAND.text}99` }}
                      >
                        {s.capacityLeft > 0
                          ? `Disp. ${s.capacityLeft}`
                          : `Completo`}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}

          {/* Acciones */}
          <div className="flex gap-2">
            <button
              onClick={createEnrollment}
              disabled={saving || !slotKey}
              className="rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition hover:brightness-95 disabled:opacity-60"
              style={{ backgroundColor: BRAND.main, color: "#fff" }}
            >
              {saving ? "Creando…" : "Crear inscripción"}
            </button>
            <button
              onClick={() => setOpen(false)}
              className="rounded-xl border px-4 py-2 text-sm font-medium transition hover:shadow-sm"
              style={{
                borderColor: BRAND.soft,
                background: "#fff",
                color: BRAND.text,
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
