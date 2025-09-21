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
    const methodParam = searchParams.get("method"); // opcional: transferencia/efectivo/otro/no_aplica
    const onlyPaid = searchParams.get("onlyPaid") === "true"; // por defecto false

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

    const matchBase = {
      year,
      month,
    };
    
    if (branchId) {
      const bid = toObjId(branchId);
      if (bid) matchBase.branch = bid;
    }
    // Por defecto consideramos inscripciones "activa" (podés quitar esta línea si querés incluir todas)
    if (stateParam) {
      matchBase.state = stateParam;
    } else {
      matchBase.state = "activa";
    }

    if (professorId) {
      const pid = toObjId(professorId);
      if (pid) matchBase.professor = pid;
    }

    if (methodParam) {
      matchBase["pay.method"] = methodParam;
    }

    const matchForMethods = {
      ...matchBase,
      ...(methodParam ? { "pay.method": methodParam } : {}),
      ...(onlyPaid
        ? { "pay.state": "pagado" }
        : { "pay.state": { $in: ["pagado", "señado"] } }),
    };

    // facet para: byMethod (pagados), byState (todos), byProfessor (pagados)
    const pipeline = [
      { $match: matchBase },
      {
        $facet: {
          byState: [
            {
              $group: {
                _id: "$pay.state",
                count: { $sum: 1 },
                amount: { $sum: { $ifNull: ["$pay.amount", 0] } },
              },
            },
          ],
          allPaidDocs: [
            { $match: matchForMethods },
            {
              $project: {
                professor: 1,
                "pay.method": 1,
                "pay.amount": 1,
              },
            },
          ],
        },
      },
      {
        $project: {
          byState: 1,
          paid: "$allPaidDocs",
        },
      },
      // segundo stage para computar byMethod y byProfessor sobre paid en memoria del pipeline
      {
        $project: {
          byState: 1,
          byMethod: {
            $map: {
              input: { $setUnion: ["$paid.pay.method", []] },
              as: "m",
              in: {
                method: "$$m",
                count: {
                  $size: {
                    $filter: {
                      input: "$paid",
                      as: "p",
                      cond: { $eq: ["$$p.pay.method", "$$m"] },
                    },
                  },
                },
                amount: {
                  $sum: {
                    $map: {
                      input: {
                        $filter: {
                          input: "$paid",
                          as: "p",
                          cond: { $eq: ["$$p.pay.method", "$$m"] },
                        },
                      },
                      as: "x",
                      in: { $ifNull: ["$$x.pay.amount", 0] },
                    },
                  },
                },
              },
            },
          },
          paid: 1,
        },
      },
    ];

    // Ejecutar
    const [res] = await Enrollment.aggregate(pipeline);

    // Armar byProfessor (pagados), con nombres
    let byProfessor = [];
    if (res?.paid?.length) {
      // agrupar en JS por professor
      const map = new Map();
      for (const doc of res.paid) {
        const pid = String(doc.professor || "");
        const curr = map.get(pid) || {
          professorId: pid,
          totalAmount: 0,
          count: 0,
          byMethod: {},
        };
        const method = doc?.pay?.method || "no_aplica";
        const amount = Number(doc?.pay?.amount || 0);
        curr.totalAmount += amount;
        curr.count += 1;
        curr.byMethod[method] = (curr.byMethod[method] || 0) + amount;
        map.set(pid, curr);
      }
      byProfessor = Array.from(map.values());

      // traer nombres
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

    // Normalizar byMethod a objeto fijo de métodos
    const methods = ["transferencia", "efectivo", "otro", "no_aplica"];
    const byMethodObj = {};
    for (const m of methods) {
      const hit = res?.byMethod?.find((x) => x.method === m);
      byMethodObj[m] = {
        amount: Number(hit?.amount || 0),
        count: Number(hit?.count || 0),
      };
    }

    // Normalizar byState a objeto fijo de estados
    const states = ["pendiente", "señado", "pagado", "cancelado"];
    const byStateObj = {};
    for (const st of states) {
      const hit = res?.byState?.find((x) => x._id === st);
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
