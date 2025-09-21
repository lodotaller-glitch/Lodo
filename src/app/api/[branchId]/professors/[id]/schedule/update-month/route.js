import { NextResponse as NR3 } from "next/server";
import dbConnect from "@/lib/dbConnect";
import {
  Enrollment,
  ProfessorSchedule,
  User,
  StudentReschedule,
} from "@/models";
import { accesAdmin } from "@/lib/authserver";
import { slotKey as makeKey } from "@/functions/slotKey";

function startOfMonthUTC(year, month) {
  return new Date(Date.UTC(year, month - 1, 1));
}

/** Find best replacement slot for a previous one inside newSlots */
function findBestSlot(prev, newSlots) {
  // 1) Try same DOW closest time
  const sameDow = newSlots.filter((s) => s.dayOfWeek === prev.dayOfWeek);
  if (sameDow.length) {
    let best = null,
      bestDiff = Infinity;
    for (const s of sameDow) {
      const diff = Math.abs((s.startMin || 0) - (prev.startMin || 0));
      if (diff < bestDiff) {
        best = s;
        bestDiff = diff;
      }
    }
    if (best) return best;
  }
  // 2) Otherwise, any closest time
  let best = null,
    bestDiff = Infinity;
  for (const s of newSlots) {
    const diff =
      Math.abs((s.startMin || 0) - (prev.startMin || 0)) +
      (s.dayOfWeek === prev.dayOfWeek ? 0 : 60);
    if (diff < bestDiff) {
      best = s;
      bestDiff = diff;
    }
  }
  return best || null;
}

export async function POST(req, { params }) {
  try {
    await dbConnect();
    if (!accesAdmin(req))
      return NR3.json({ error: "Unauthorized" }, { status: 403 });

    const { id: professorId, branchId } = params; // professor
    const {
      year,
      month,
      newSlots = [],
      applyTo = "current",
    } = await req.json();

    if (!year || !month || !Array.isArray(newSlots))
      return NR3.json(
        { error: "Missing year/month/newSlots" },
        { status: 400 }
      );

    // 1) Update/Upsert schedule for the target month
    const monthStart = startOfMonthUTC(year, month);
    let sched = await ProfessorSchedule.findActiveForDate(
      professorId,
      monthStart
    );
    if (!sched) {
      // create schedule effective for this month only (or open-ended until changed)
      sched = await ProfessorSchedule.create({
        professor: professorId,
        effectiveFrom: monthStart,
        effectiveTo: null, // open-ended; your model may prefer month-end
        slots: newSlots,
        branch: branchId,
      });
    } else {
      sched.slots = newSlots;
      await sched.save();
    }

    // 2) Auto-reassign enrolled students for that (year, month)
    const prof = await User.findById(professorId).lean();
    const capacity = Math.max(1, Number(prof?.capacity ?? 10));

    // Build capacity map per slot (monthly), excluding each enrollment when evaluating itself
    const counts = new Map(); // key: slotKey -> count
    const assignedEnrs = await Enrollment.find({
      professor: professorId,
      year,
      month,
      $or: [{ state: "activa" }, { estado: "activa" }],
      $or: [{ assigned: true }, { asignado: true }],
    }).lean();

    for (const e of assignedEnrs) {
      for (const s of e.chosenSlots || e.slotsElegidos || []) {
        const k = makeKey(s, professorId);
        counts.set(k, (counts.get(k) || 0) + 1);
      }
    }

    const newKeySet = new Set(newSlots.map((s) => makeKey(s, professorId)));

    const changes = [];
    for (const e of assignedEnrs) {
      const out = [];
      for (const s of e.chosenSlots || []) {
        const k = makeKey(s, professorId);
        if (newKeySet.has(k)) {
          out.push(s);
          continue;
        }
        // Need replacement
        const cand = findBestSlot(s, newSlots);
        if (!cand) {
          out.push(s);
          continue;
        }
        const ck = makeKey(cand, professorId);
        // capacity check excluding current enrollment
        const taken = counts.get(ck) || 0;
        if (taken >= capacity) {
          // try other alternatives (simple: pick any with available)
          const others = newSlots.filter((x) => makeKey(x, professorId) !== ck);
          let placed = false;
          for (const alt of others) {
            const ak = makeKey(alt, professorId);
            const ataken = counts.get(ak) || 0;
            if (ataken < capacity) {
              out.push(alt);
              counts.set(ak, ataken + 1);
              placed = true;
              break;
            }
          }
          if (!placed) out.push(s); // fallback keep
        } else {
          out.push(cand);
          counts.set(ck, taken + 1);
        }
      }
      // de-dup within two slots
      const uniq = [];
      const seen = new Set();
      for (const s of out) {
        const k2 = makeKey(s, professorId);
        if (seen.has(k2)) continue;
        seen.add(k2);
        uniq.push(s);
      }
      await Enrollment.updateOne(
        { _id: e._id },
        { $set: { chosenSlots: uniq } }
      );
      changes.push({ enrollmentId: e._id, before: e.chosenSlots, after: uniq });
    }

    return NR3.json({
      ok: true,
      scheduleId: sched._id,
      reassigned: changes.length,
      changes,
    });
  } catch (err) {
    console.error("POST /api/professors/[id]/schedule/update-month", err);
    return NR3.json(
      { error: "Server error", details: err?.message },
      { status: 500 }
    );
  }
}
