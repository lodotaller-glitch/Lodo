// app/api/[branchId]/students/bulk/preview/route.js
import { NextResponse } from "next/server";
export const runtime = "nodejs";

import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";
import Enrollment from "@/models/Enrollment";
import { ProfessorSchedule } from "@/models";
import mongoose from "mongoose";
import * as XLSX from "xlsx";

// helpers --------------//
const DOW = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miércoles: 3,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sábado: 6,
  sabado: 6,
};
const fmt = (n) => (n < 10 ? "0" + n : "" + n);
function toObjId(x) {
  try {
    return new mongoose.Types.ObjectId(String(x));
  } catch {
    return null;
  }
}
function timeToMin(s) {
  // "10:00"
  const m = String(s || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = +m[1],
    mi = +m[2];
  return h * 60 + mi;
}
function parseTimeRange(s) {
  // "10:00-12:00"
  const [a, b] = String(s || "")
    .split("-")
    .map((t) => t.trim());
  const start = timeToMin(a),
    end = timeToMin(b);
  return start != null && end != null && end > start
    ? { startMin: start, endMin: end }
    : null;
}

// Helpers para interpretar "Horario "
function stripAccents(str) {
  return String(str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
function parseHorario(raw, defaultMinutes = 120) {
  if (!raw) return null;
  const s = stripAccents(String(raw).trim().toLowerCase()); // "lun 14h", "mie 10:00-12:00", "vie 16 a 18"
  // detectar día (acepta abreviaturas)
  const dayMap = {
    domingo: 0,
    dom: 0,
    lunes: 1,
    lun: 1,
    martes: 2,
    mart: 2,
    mar: 2,
    miercoles: 3,
    mierc: 3,
    mie: 3,
    jueves: 4,
    juev: 4,
    jue: 4,
    viernes: 5,
    vier: 5,
    vie: 5,
    sabado: 6,
    sab: 6,
  };
  let dayOfWeek = null;
  for (const k of Object.keys(dayMap)) {
    if (s.startsWith(k + " ") || s === k) {
      dayOfWeek = dayMap[k];
      break;
    }
  }
  // patrones de hora
  const range = /(\d{1,2})(?::(\d{2}))?\s*(?:-| a )\s*(\d{1,2})(?::(\d{2}))?/; // "14-16", "14:00-16:00", "14 a 16"
  const single = /(\d{1,2})(?::(\d{2}))?\s*h?s?\b/; // "14h", "14hs", "14:30"
  let startMin = null,
    endMin = null;

  const m1 = s.match(range);
  if (m1) {
    const h1 = +m1[1],
      mi1 = m1[2] ? +m1[2] : 0;
    const h2 = +m1[3],
      mi2 = m1[4] ? +m1[4] : 0;
    startMin = h1 * 60 + mi1;
    endMin = h2 * 60 + mi2;
  } else {
    const m2 = s.match(single);
    if (m2) {
      const h = +m2[1],
        mi = m2[2] ? +m2[2] : 0;
      startMin = h * 60 + mi;
      endMin = startMin + defaultMinutes; // asunción si no dan fin
    }
  }

  if (
    dayOfWeek == null ||
    startMin == null ||
    endMin == null ||
    endMin <= startMin
  ) {
    return null;
  }
  return { dayOfWeek, startMin, endMin };
}

// ✅ Nueva normalizeRow
function normalizeRow(r) {
  // columnas tal como vienen en tu Excel (con espacios)
  const name = r["Nombre y Apellido"] || r["Nombre"] || "";
  const email = r["Gmail "] || r["Gmail"] || r["Email"] || r["email"] || "";
  const horarioRaw = r["Horario"] || "";

  // preferencia desde "Horario " (ej: "Lun 14h", "Mar 10-12", "Mie 10:00-12:00")
  const prefFromHorario = parseHorario(horarioRaw);

  // fallback por si tenés otras columnas (respetamos tu implementación previa)
  const diaFallback = (
    r.preferencia_dia ||
    r["preferencia dia"] ||
    r["dia"] ||
    r["Día"] ||
    ""
  )
    .toString()
    .toLowerCase()
    .trim();
  const rangoFallback =
    r.preferencia_hora ||
    r["preferencia hora"] ||
    r["hora"] ||
    r["Horario"] ||
    "";
  // Si ya tenés un DOW global, lo aprovechamos; si no, lo deja en null y se usa prefFromHorario.
  const prefDow =
    typeof DOW !== "undefined" && DOW[diaFallback] != null
      ? DOW[diaFallback]
      : null;
  const prefRange =
    typeof parseTimeRange === "function" ? parseTimeRange(rangoFallback) : null;

  const profesorHint = r.profesor || r["Profesor"] || r["teacher"] || "";

  return {
    name: String(name || "").trim(),
    email: String(email || "").trim(),
    password: "12345", // fijo como pediste
    preference:
      prefFromHorario ||
      (prefDow != null && prefRange
        ? { dayOfWeek: prefDow, ...prefRange }
        : null),
    profesorHint: String(profesorHint || "").trim() || null,
  };
}

function slotDistance(pref, slot) {
  if (!pref) return 99999;
  const dayPenalty = pref.dayOfWeek === slot.dayOfWeek ? 0 : 720; // 12h si no coincide día
  const startDiff = Math.abs(pref.startMin - slot.startMin);
  const endDiff = Math.abs(pref.endMin - slot.endMin);
  return dayPenalty + startDiff + endDiff;
}
function dateOnlyISO(d) {
  const only = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
  return only.toISOString();
}

export async function POST(req, { params }) {
  try {
    await dbConnect();
    const { branchId } = await params;

    const form = await req.formData();
    const file = form.get("file");
    const year = Number(form.get("year"));
    const month = Number(form.get("month"));

    if (!file || !year || !month) {
      return NextResponse.json(
        { error: "Faltan file/year/month" },
        { status: 400 }
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    const normalized = rows.map(normalizeRow).filter((r) => r.name && r.email);

    // Schedules vigentes del mes
    const monthStart = new Date(Date.UTC(year, month - 1, 1));
    const schedules = await ProfessorSchedule.find({
      branch: branchId,
      effectiveFrom: { $lte: monthStart },
      $or: [{ effectiveTo: null }, { effectiveTo: { $gt: monthStart } }],
    }).lean();

    if (!schedules.length) {
      return NextResponse.json({
        items: normalized,
        suggestions: [],
        note: "No hay schedules vigentes",
      });
    }

    // Capacidades por profesor
    const profIds = [...new Set(schedules.map((s) => String(s.professor)))];
    const profUsers = await User.find({ _id: { $in: profIds } })
      .select("_id name capacity")
      .lean();
    const capacityByProf = new Map(
      profUsers.map((u) => [String(u._id), Number(u.capacity ?? 10)])
    );

    // Conteo de tomados en el mes por slot (solo asignados y activas)
    const enrolls = await Enrollment.find({
      professor: { $in: profIds },
      year,
      month,
      state: "activa",
      assigned: true,
    })
      .select("professor chosenSlots")
      .lean();

    const takenByProfSlot = new Map(); // `${pid}|d|s|e` -> count
    const inc = (k) =>
      takenByProfSlot.set(k, (takenByProfSlot.get(k) || 0) + 1);
    for (const e of enrolls) {
      const pid = String(e.professor);
      for (const s of e.chosenSlots || []) {
        const k = `${pid}|${s.dayOfWeek}|${s.startMin}|${s.endMin}`;
        inc(k);
      }
    }

    // Armar catálogo de opciones por profesor/slot
    const catalog = []; // { professorId, professorName, slot, capacityLeft }
    const profName = (id) =>
      profUsers.find((u) => String(u._id) === id)?.name || "Profesor";
    for (const sc of schedules) {
      const pid = String(sc.professor);
      const cap = Math.max(1, capacityByProf.get(pid) || 10);
      for (const s of sc.slots) {
        const key = `${pid}|${s.dayOfWeek}|${s.startMin}|${s.endMin}`;
        const taken = takenByProfSlot.get(key) || 0;
        const left = Math.max(0, cap - taken);
        catalog.push({
          professorId: pid,
          professorName: profName(pid),
          slot: {
            dayOfWeek: s.dayOfWeek,
            startMin: s.startMin,
            endMin: s.endMin,
          },
          capacityLeft: left,
        });
      }
    }

    // Sugerencias por alumno (top 3)
    const suggestionsByIndex = normalized.map((row) => {
      // si dio profesor por nombre, priorizarlo
      const filtered = row.profesorHint
        ? catalog.filter((c) =>
            c.professorName
              .toLowerCase()
              .includes(row.profesorHint.toLowerCase())
          )
        : catalog;

      const scored = filtered
        .map((opt) => ({
          ...opt,
          score: slotDistance(row.preference, opt.slot),
          status: opt.capacityLeft > 0 ? "available" : "full",
        }))
        .sort((a, b) => a.score - b.score || b.capacityLeft - a.capacityLeft);

      return scored.slice(0, 3);
    });

    return NextResponse.json({
      ok: true,
      year,
      month,
      branchId,
      items: normalized,
      suggestions: suggestionsByIndex,
    });
  } catch (err) {
    console.error("bulk/preview error:", err);
    return NextResponse.json(
      { error: "Error del servidor", details: err?.message },
      { status: 500 }
    );
  }
}
