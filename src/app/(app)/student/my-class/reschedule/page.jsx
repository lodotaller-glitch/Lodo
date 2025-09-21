"use client";
import { use, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  fetchEnrollmentsByStudent,
  fetchRescheduleOptions,
} from "@/functions/request/schedule";
import { createOrUpdateReschedule } from "@/functions/request/enrollments";
import { addHours, parseISO, differenceInMinutes } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { es } from "date-fns/locale";
import { useRouter } from "next/navigation";

const BRAND = { main: "#A08775", soft: "#DDD7C9", text: "#1F1C19" };
const TZ = "America/Argentina/Cordoba";
const fmt = (d, pattern = "EEE d/MM HH:mm") =>
  formatInTimeZone(typeof d === "string" ? parseISO(d) : d, TZ, pattern, {
    locale: es,
  });

function OptionCard({ opt, onChoose, disabled }) {
  const startLocal = addHours(parseISO(opt.to), 3);
  const endLocal = addHours(parseISO(opt.endISO), 3);
  const durMin = Math.max(0, differenceInMinutes(endLocal, startLocal));

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChoose(opt)}
      className="group flex w-full items-center justify-between gap-3 rounded-2xl border p-4 text-left shadow-sm transition focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
      style={{
        borderColor: BRAND.soft,
        background: `linear-gradient(180deg, ${BRAND.soft}40, #FFFFFF)`,
      }}
    >
      <div className="min-w-0">
        <div className="text-sm font-medium" style={{ color: BRAND.text }}>
          {fmt(startLocal, "EEE d/MM")}
        </div>
        <div
          className="text-lg font-semibold leading-tight"
          style={{ color: BRAND.text }}
        >
          {fmt(startLocal, "HH:mm")} – {fmt(endLocal, "HH:mm")}
        </div>
        <div className="mt-1 text-xs" style={{ color: `${BRAND.text}99` }}>
          {durMin} min
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <span
          className="rounded-xl px-3 py-1 text-sm font-medium transition group-hover:translate-x-0.5"
          style={{ backgroundColor: BRAND.main, color: "#fff" }}
        >
          Elegir
        </span>
      </div>
    </button>
  );
}

export default function ReprogramarClasePage({ searchParams }) {
  const { user } = useAuth();
  const { start, profesorId } = use(searchParams);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [options, setOptions] = useState([]);
  const [enrollmentId, setEnrollmentId] = useState(null);
  const [slotFrom, setSlotFrom] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?._id || !start || !profesorId) return;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const { enrollments } = await fetchEnrollmentsByStudent(
          user?._id,
          user?.branch
        );
        const startDate = new Date(start);
        const year = startDate.getUTCFullYear();
        const month = startDate.getUTCMonth() + 1;
        const enrollment = enrollments?.find(
          (e) =>
            e.year === year &&
            e.month === month &&
            String(e.professor?._id || e.professor || e.profesor) ===
              String(profesorId)
        );
        if (!enrollment) {
          setError("No se encontró la inscripción");
          setLoading(false);
          return;
        }
        setSlotFrom(enrollment.chosenSlots[0]);
        setEnrollmentId(enrollment._id);
        const { options } = await fetchRescheduleOptions({
          enrollmentId: enrollment._id,
          fromDateISO: startDate.toISOString(),
          branchId: user?.branch,
        });
        setOptions(options || []);
      } catch (err) {
        console.error(err);
        setError(err?.message || "No se pudieron cargar opciones");
      } finally {
        setLoading(false);
      }
    })();
  }, [start, profesorId, user]);

  async function handleChoose(opt) {
    if (!enrollmentId) return;

    // Carga on-demand de SweetAlert2 para evitar peso extra inicial
    const Swal = (await import("sweetalert2")).default;

    const originalLocal = addHours(parseISO(start), 3);
    const nuevoInicio = addHours(parseISO(opt.to), 3);
    const nuevoFin = addHours(parseISO(opt.endISO), 3);

    const result = await Swal.fire({
      title: "¿Reprogramar esta clase?",
      html: `\
        <div style="text-align:left">\
          <p style="margin:0 0 8px">Esta acción se puede realizar <b>una sola vez en todo el mes</b>.</p>\
          <ul style="margin:0; padding-left:18px">\
            <li><b>Original:</b> ${fmt(originalLocal)}</li>\
            <li><b>Nuevo:</b> ${fmt(nuevoInicio, "EEE d/MM HH:mm")} – ${fmt(
        nuevoFin,
        "HH:mm"
      )}</li>\
          </ul>\
        </div>\
      `,
      icon: "warning",
      iconColor: BRAND.main,
      showCancelButton: true,
      reverseButtons: true,
      confirmButtonText: "Sí, reprogramar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: BRAND.main,
      cancelButtonColor: "#6B7280",
      focusCancel: true,
      allowOutsideClick: () => !Swal.isLoading(),
      showLoaderOnConfirm: true,
      preConfirm: async () => {
        try {
          setSaving(true);
          await createOrUpdateReschedule({
            enrollmentId,
            fromDateISO: new Date(start).toISOString(),
            toDateISO: opt.to,
            toProfessorId: opt.professorId,
            slotTo: opt.slotTo,
            slotFrom,
            branchId: user?.branch,
          });
        } catch (e) {
          Swal.showValidationMessage(e?.message || "No se pudo reprogramar");
          Swal.close();

          setError(e?.response?.data.error || "No se pudo reprogramar");
          throw e;
        } finally {
          setSaving(false);
        }
      },
    });

    if (result.isConfirmed) {
      await Swal.fire({
        title: "¡Listo!",
        text: "Tu clase fue reprogramada correctamente.",
        icon: "success",
        confirmButtonColor: BRAND.main,
      });
      // Opcional: redirigir luego del éxito
      router.push(`/student`);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl p-4 sm:p-6">
        <div className="mb-4 h-8 w-52 animate-pulse rounded-xl bg-black/10" />
        <ul className="grid gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <li
              key={i}
              className="rounded-2xl border p-4"
              style={{ borderColor: BRAND.soft }}
            >
              <div className="h-14 w-full animate-pulse rounded-xl bg-black/5" />
            </li>
          ))}
        </ul>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl p-4 sm:p-6 space-y-4">
      {/* Encabezado */}
      <div
        className="rounded-2xl border"
        style={{
          borderColor: BRAND.soft,
          background: `linear-gradient(180deg, ${BRAND.soft}55, transparent)`,
        }}
      >
        <div className="flex items-center justify-between px-4 py-3 sm:px-6">
          <h1 className="text-xl font-semibold" style={{ color: BRAND.text }}>
            Reprogramar clase
          </h1>
          {start && (
            <span
              className="rounded-full px-3 py-1 text-xs"
              style={{
                backgroundColor: BRAND.soft,
                color: BRAND.text,
                border: `1px solid ${BRAND.main}55`,
              }}
            >
              Original: {fmt(addHours(parseISO(start), 3))}
            </span>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <p
          role="alert"
          className="rounded-xl border px-3 py-2 text-sm"
          style={{
            color: "#991B1B",
            backgroundColor: "#FEF2F2",
            borderColor: "#FECACA",
          }}
        >
          {error}
        </p>
      )}

      {/* Opciones */}
      {options.length === 0 && !error ? (
        <div
          className="rounded-2xl border border-dashed p-6 text-center text-sm"
          style={{ borderColor: `${BRAND.main}66`, color: `${BRAND.text}99` }}
        >
          No hay opciones disponibles.
        </div>
      ) : (
        <ul className="grid gap-3">
          {options.map((opt, idx) => (
            <li key={idx}>
              <OptionCard opt={opt} onChoose={handleChoose} disabled={saving} />
            </li>
          ))}
        </ul>
      )}

      {/* Ayuda */}
      <p className="text-xs" style={{ color: `${BRAND.text}99` }}>
        Tip: elegí el horario que mejor te quede. Si no ves opciones, probá más
        tarde o contactá a tu profesor/a.
      </p>
    </main>
  );
}
