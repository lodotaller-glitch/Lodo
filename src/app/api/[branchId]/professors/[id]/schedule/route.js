import { NextResponse as NR4 } from "next/server";
import dbConnect from "@/lib/dbConnect";
import { Enrollment, ProfessorSchedule } from "@/models";

export async function GET(req, { params }) {
  await dbConnect();
  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));
  const { id } = await params;
  if (!year || !month)
    return NR4.json({ error: "Missing year/month" }, { status: 400 });
  const sched = await ProfessorSchedule.findActiveForDate(
    id,
    new Date(Date.UTC(year, month - 1, 1))
  );
  return NR4.json({
    schedule: sched ? { id: sched._id, slots: sched.slots } : null,
  });
}


import mongoose from "mongoose";

export const runtime = "nodejs";

const toObjId = (v) => {
  try {
    return new mongoose.Types.ObjectId(String(v));
  } catch {
    return null;
  }
};
const startOfMonthUTC = (y, m) => new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
const endOfMonthUTC = (y, m) => new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));

export async function PUT(req, { params }) {
  await dbConnect();
  const { branchId, id: professorId } = await params;

  const url = new URL(req.url);
  const applyY = Number(
    url.searchParams.get("applyFromYear") || url.searchParams.get("year")
  );
  const applyM = Number(
    url.searchParams.get("applyFromMonth") || url.searchParams.get("month")
  );

  const body = await req.json();
  const newSlots = Array.isArray(body.slots) ? body.slots : [];

  if (
    !Number.isInteger(applyY) ||
    !Number.isInteger(applyM) ||
    applyM < 1 ||
    applyM > 12
  ) {
    return NR4.json(
      { error: "Faltan applyFromYear/applyFromMonth" },
      { status: 400 }
    );
  }

  const applyFromDate = startOfMonthUTC(applyY, applyM);

  // 1) Schedule que cubre esa fecha (vigente ese mes)
  const current = await ProfessorSchedule.findOne({
    professor: toObjId(professorId),
    branch: toObjId(branchId),
    effectiveFrom: { $lte: applyFromDate },
    $or: [{ effectiveTo: null }, { effectiveTo: { $gt: applyFromDate } }],
  }).lean();

  let updatedSchedule;

  if (
    current &&
    new Date(current.effectiveFrom).getTime() === applyFromDate.getTime()
  ) {
    // Caso A: ya hay un schedule que arranca EXACTO en esa fecha → actualizar sus slots
    updatedSchedule = await ProfessorSchedule.findByIdAndUpdate(
      current._id,
      { $set: { slots: newSlots } },
      { new: true }
    );

  } else {
    // Caso B: no existe; hay que cortar el schedule anterior y crear uno nuevo
    if (current) {
      await ProfessorSchedule.updateOne(
        { _id: current._id },
        { $set: { effectiveTo: applyFromDate } } // cerramos el anterior justo al inicio del mes
      );
    }
    updatedSchedule = await ProfessorSchedule.create({
      professor: toObjId(professorId),
      branch: toObjId(branchId),
      effectiveFrom: applyFromDate,
      effectiveTo: null,
      slots: newSlots,
    });
  }

  if (!updatedSchedule) {
    return NR4.json(
      { error: "No se pudo guardar el horario" },
      { status: 400 }
    );
  }

  // 2) Limpiar inscripciones del MES afectado
  //    - chosenSlots = chosenSlots ∩ newSlots
  //    - assigned = false si queda vacío
  const keepConds = newSlots.map((s) => ({
    $and: [
      { $eq: ["$$cs.dayOfWeek", Number(s.dayOfWeek)] },
      { $eq: ["$$cs.startMin", Number(s.startMin)] },
      { $eq: ["$$cs.endMin", Number(s.endMin)] },
    ],
  }));
  const filterCond = keepConds.length ? { $or: keepConds } : false;

  const matchEnroll = {
    professor: toObjId(professorId),
    branch: toObjId(branchId),
    $or: [{ state: "activa" }, { estado: "activa" }],
    year: applyY,
    month: applyM,
  };

  const preCount = await Enrollment.countDocuments(matchEnroll);

  const res = await Enrollment.updateMany(
    matchEnroll,
    [
      {
        $set: {
          chosenSlots: {
            $filter: {
              input: "$chosenSlots",
              as: "cs",
              cond: filterCond, // si no hay slots nuevos → []
            },
          },
        },
      },
      {
        $set: {
          assigned: {
            $cond: [
              { $eq: [{ $size: "$chosenSlots" }, 0] },
              false,
              "$assigned",
            ],
          },
        },
      },
    ] // runValidators=false por defecto permite dejar []
  );

  return NR4.json({
    ok: true,
    schedule: {
      id: updatedSchedule._id,
      effectiveFrom: updatedSchedule.effectiveFrom,
      effectiveTo: updatedSchedule.effectiveTo,
      slots: updatedSchedule.slots,
    },
    cleanup: {
      candidates: preCount,
      matched: res.matchedCount ?? res.nMatched ?? 0,
      modified: res.modifiedCount ?? res.nModified ?? 0,
      scope: { year: applyY, month: applyM },
    },
  });
}
