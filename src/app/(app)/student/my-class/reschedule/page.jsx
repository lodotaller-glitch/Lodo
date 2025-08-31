"use client";
import { useParams, useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import {
  fetchEnrollmentsByStudent,
  fetchRescheduleOptions,
} from "@/functions/request/schedule";
import { useAuth } from "@/context/AuthContext";
import {
  createOrUpdateReschedule,
  getEnrollmentOccurrences,
  getRescheduleOptions,
} from "@/functions/request/enrollments";

import { addHours, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { es } from "date-fns/locale";

const TZ = "America/Argentina/Cordoba";
const fmt = (d, pattern = "EEE d/MM HH:mm") =>
  formatInTimeZone(typeof d === "string" ? parseISO(d) : d, TZ, pattern, {
    locale: es,
  });

export default function ReprogramarClasePage({ searchParams }) {
  const { user } = useAuth();
  const { start, profesorId } = use(searchParams);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [options, setOptions] = useState([]);
  const [enrollmentId, setEnrollmentId] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    console.log(user);
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
    try {
      setSaving(true);
      setError("");
      await createOrUpdateReschedule({
        enrollmentId,
        fromDateISO: new Date(start).toISOString(),
        toProfessorId: opt.professorId,
        slotTo: opt.slotTo,
        branchId: user?.branch,
      });
      // router.push(`/${user?.branch}/mi-calendario`);
    } catch (err) {
      console.error(err);
      setError(err?.message || "No se pudo reprogramar");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main className="p-6">Cargando…</main>;

  return (
    <main className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Reprogramar clase</h1>
      {error && (
        <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>
      )}
      {options.length === 0 && !error && (
        <p className="text-sm">No hay opciones disponibles</p>
      )}
      <ul className="space-y-2">
        {options.map((opt, idx) => (
          <li key={idx}>
            <button
              disabled={saving}
              onClick={() => handleChoose(opt)}
              className="w-full text-left px-4 py-2 rounded-xl bg-white shadow flex items-center gap-3 justify-evenly"
            >
              {/* INICIO — usa opt.to */}
              <div className="text-sm">
                {fmt(addHours(parseISO(opt.to), 3))}
              </div>
              <span>–</span>
              {/* FIN — usa endISO; solo hora para que quede prolijo */}
              <div className="text-sm">
                {fmt(addHours(parseISO(opt.endISO), 3), "HH:mm")}
              </div>

              {/* opcional: cupos a la derecha
              {"capacityLeft" in opt && (
                <div className="ml-auto text-xs text-gray-500">
                  {opt.capacityLeft} cupos
                </div>
              )} */}
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
