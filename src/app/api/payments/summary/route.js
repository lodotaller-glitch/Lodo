// app/api/payments/summary/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Enrollment from "@/models/Enrollment";
import User from "@/models/User";
import mongoose from "mongoose";

function toObjId(id) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

export async function GET(req) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);

    const year = Number(searchParams.get("year"));
    const month = Number(searchParams.get("month"));
    const branchId = searchParams.get("branchId");
    const professorId = searchParams.get("professorId");
    const stateParam = searchParams.get("state"); // opcional: activa/cancelada
    const methodParam = searchParams.get("method"); // opcional
    const onlyPaid = searchParams.get("onlyPaid") === "true"; // default false

    if (
      !Number.isInteger(year) ||
      !Number.isInteger(month) ||
      month < 1 ||
      month > 12
    ) {
      return NextResponse.json(
        { error: "Parámetros year/month inválidos" },
        { status: 400 }
      );
    }

    const matchBase = { year, month };
    if (branchId) {
      const bid = toObjId(branchId);
      if (bid) matchBase.branch = bid;
    }
    matchBase.state = stateParam || "activa";
    if (professorId) {
      const pid = toObjId(professorId);
      if (pid) matchBase.professor = pid;
    }

    // Estados considerados "cobrados"
    const paidStates = onlyPaid ? ["pagado"] : ["pagado", "señado"];

    const pipeline = [
      { $match: matchBase },
      // Empaquetamos pay y pay2 como array de "payments"
      {
        $project: {
          professor: 1,
          payments: [
            {
              state: { $ifNull: ["$pay.state", "pendiente"] },
              method: { $ifNull: ["$pay.method", "no_aplica"] },
              amount: { $ifNull: ["$pay.amount", 0] },
            },
            {
              state: { $ifNull: ["$pay2.state", "pendiente"] },
              method: { $ifNull: ["$pay2.method", "no_aplica"] },
              amount: { $ifNull: ["$pay2.amount", 0] },
            },
          ],
        },
      },
      { $unwind: "$payments" },

      {
        $facet: {
          // 1) byState: TODOS los pagos por estado
          byState: [
            {
              $group: {
                _id: "$payments.state",
                count: { $sum: 1 },
                amount: { $sum: { $ifNull: ["$payments.amount", 0] } },
              },
            },
          ],

          // 2) byMethod: SOLO pagos cobrados (respeta methodParam si viene)
          byMethod: [
            {
              $match: {
                "payments.state": { $in: paidStates },
                ...(methodParam ? { "payments.method": methodParam } : {}),
              },
            },
            {
              $group: {
                _id: "$payments.method",
                count: { $sum: 1 },
                amount: { $sum: { $ifNull: ["$payments.amount", 0] } },
              },
            },
          ],

          // 3) paidDocs para byProfessor (en JS)
          paidDocs: [
            {
              $match: {
                "payments.state": { $in: paidStates },
                ...(methodParam ? { "payments.method": methodParam } : {}),
              },
            },
            {
              $project: {
                professor: 1,
                payments: {
                  method: "$payments.method",
                  amount: "$payments.amount",
                },
              },
            },
          ],
        },
      },
    ];

    const [agg] = await Enrollment.aggregate(pipeline);

    // --- byMethod normalizado a objeto fijo ---
    const methods = ["transferencia", "efectivo", "otro", "no_aplica"];
    const byMethodObj = {};
    for (const m of methods) {
      const hit = (agg?.byMethod || []).find((x) => x._id === m);
      byMethodObj[m] = {
        amount: Number(hit?.amount || 0),
        count: Number(hit?.count || 0),
      };
    }

    // --- byProfessor (sobre pagos cobrados) ---
    const profMap = new Map();
    for (const d of agg?.paidDocs || []) {
      const pid = String(d.professor || "");
      const m = d.payments?.method || "no_aplica";
      const amt = Number(d.payments?.amount || 0);
      const cur = profMap.get(pid) || {
        professorId: pid,
        totalAmount: 0,
        count: 0,
        byMethod: {},
      };
      cur.totalAmount += amt;
      cur.count += 1;
      cur.byMethod[m] = (cur.byMethod[m] || 0) + amt;
      profMap.set(pid, cur);
    }
    let byProfessor = Array.from(profMap.values());

    if (byProfessor.length) {
      const profIds = byProfessor
        .filter((x) => x.professorId)
        .map((x) => toObjId(x.professorId))
        .filter(Boolean);

      const users = await User.find({ _id: { $in: profIds } })
        .select("_id name nombre")
        .lean();

      const nameById = new Map(
        users.map((u) => [String(u._id), u.name || u.nombre || "Profesor"])
      );

      byProfessor = byProfessor.map((x) => ({
        ...x,
        professorName: nameById.get(x.professorId) || "Profesor",
      }));
    }

    // --- byState normalizado ---
    const states = ["pendiente", "señado", "pagado", "cancelado"];
    const byStateObj = {};
    for (const st of states) {
      const hit = (agg?.byState || []).find((x) => x._id === st);
      byStateObj[st] = {
        amount: Number(hit?.amount || 0),
        count: Number(hit?.count || 0),
      };
    }

    const totalPaid = methods.reduce(
      (acc, m) => acc + byMethodObj[m].amount,
      0
    );

    return NextResponse.json({
      year,
      month,
      branchId,
      professorId,
      onlyPaid,
      method: methodParam || null,
      byMethod: byMethodObj,
      byState: byStateObj,
      byProfessor,
      totalPaid,
    });
  } catch (err) {
    console.error("GET /api/payments/summary error:", err);
    return NextResponse.json(
      { error: "Error del servidor", details: err?.message },
      { status: 500 }
    );
  }
}
