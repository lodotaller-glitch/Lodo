// /app/api/[branchId]/classes/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import { Enrollment, Attendance, User, StudentReschedule } from "@/models";
import AdhocClass from "@/models/AdhocClass";

function parseSlot(slot) {
  const [professorId, dayOfWeek, startMin, endMin] = slot
    .split("-")
    .map(String);
  return {
    professorId,
    dayOfWeek: Number(dayOfWeek),
    startMin: Number(startMin),
    endMin: Number(endMin),
  };
}

function startOfDayUTC(d) {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0)
  );
}
function endOfDayUTC(d) {
  return new Date(
    Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      23,
      59,
      59,
      999
    )
  );
}

const dayOfWeekUTC = (d) => d.getUTCDay();
const startMinUTC = (d) => d.getUTCHours() * 60 + d.getUTCMinutes();

export async function GET(req, { params }) {
  try {
    await dbConnect();
    const { branchId } = await params;
    const { searchParams } = new URL(req.url);
    const start = searchParams.get("start");
    const slot = searchParams.get("slot");
    const adhoc = searchParams.get("adhoc");
    if (!start || !slot) {
      return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
    }

    const date = new Date(start);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const dayStart = startOfDayUTC(date);
    const dayEnd = endOfDayUTC(date);

    const { professorId, dayOfWeek, startMin, endMin } = parseSlot(slot);

    let enrollments = [];
    if (adhoc === "true") {
      enrollments = await AdhocClass.find({
        branch: branchId,
        professor: professorId,
        year,
        month,
        state: "activa",
      })
        .select("student chosenSlots assigned pay.state pay2.state")
        .populate("student", "name")
        .lean();
    } else {
      // 1) Enrollments regulares que matchean la franja
      enrollments = await Enrollment.find({
        branch: branchId,
        professor: professorId,
        year,
        month,
        state: "activa",
      })
        .select("student chosenSlots assigned pay.state pay2.state")
        .populate("student", "name")
        .lean();
    }

    const enById = new Map(enrollments.map((e) => [String(e._id), e]));
    // Base regulares asignados que tienen ese slot
    const regularBase = [];
    for (const e of enrollments) {
      const isAssigned = e.assigned === true;
      if (!isAssigned) continue;
      const match = (e.chosenSlots || []).some(
        (s) =>
          s.dayOfWeek === dayOfWeek &&
          s.startMin === startMin &&
          s.endMin === endMin
      );
      if (match) {
        const payState = e?.pay2?.state || e?.pay?.state || "pendiente";
        regularBase.push({
          id: String(e.student._id),
          name: e.student.name,
          enrollmentId: String(e._id),
          origin: "regular",
          payState, // 👈 "pagado" | "señado" | "pendiente" | "cancelado"
          paid: payState === "pagado", // 👈 comodidad para la UI
        });
      }
    }

    // 2) Reprogramaciones OUT de esta fecha+slot+profesor
    const resOutDocs = await StudentReschedule.find({
      $and: [
        {
          $or: [
            { fromProfessor: professorId },
            { professor: professorId }, // compat legado
          ],
        },
        { fromDate: { $gte: dayStart, $lte: dayEnd } },
        {
          "slotFrom.dayOfWeek": dayOfWeek,
          "slotFrom.startMin": startMin,
          "slotFrom.endMin": endMin,
        },
      ],
    })
      .select("enrollment student")
      .lean();

    const outEnrollmentIds = new Set(
      resOutDocs
        .map((r) => (r.enrollment ? String(r.enrollment) : null))
        .filter(Boolean)
    );
    const outStudentIds = new Set(
      resOutDocs
        .map((r) => (r.student ? String(r.student) : null))
        .filter(Boolean)
    );

    // 3) Reprogramaciones IN hacia esta fecha+slot+profesor
    const resInDocs = await StudentReschedule.find({
      $and: [
        {
          $or: [
            { toProfessor: professorId },
            { professor: professorId }, // compat legado
          ],
        },
        { toDate: { $gte: dayStart, $lte: dayEnd } },
        {
          "slotTo.dayOfWeek": dayOfWeek,
          "slotTo.startMin": startMin,
          "slotTo.endMin": endMin,
        },
      ],
    })
      .select("enrollment student")
      .populate("student", "name")
      .populate("enrollment", "pay.state pay2.state")
      .lean();

    const rescheduleIn = resInDocs.map((r) => {
      const enId = r?.enrollment?._id ? String(r?.enrollment?._id) : null;
      const en = enId ? enById.get(enId) || r?.enrollment : null;

      const payState = en?.pay2?.state || en?.pay?.state || null;
      return {
        id: r.student ? String(r.student._id || r.student) : undefined,
        name: r.student?.name || "Alumno",
        enrollmentId: enId,
        origin: "reschedule-in",
        payState,
        paid: payState === "pagado",
      };
    });

    // 4) Regulares vigentes = base - OUT
    const regularActive = regularBase.filter(
      (s) => !outEnrollmentIds.has(s.enrollmentId) && !outStudentIds.has(s.id)
    );

    // 5) Asistencias (REGULAR) de todos los enrollmentIds relevantes en esta fecha
    const allEnrollmentIds = [
      ...new Set([
        ...regularActive.map((s) => s.enrollmentId),
        ...rescheduleIn
          .map((s) => s.enrollmentId)
          .filter((x) => x && x !== "null"),
      ]),
    ];
    // console.log(date, "date");

    const attRegular = allEnrollmentIds.length
      ? await Attendance.find({
          date: { $gte: dayStart, $lte: dayEnd },
          enrollment: { $in: allEnrollmentIds },
          origin: { $in: [null, "regular"] },
        })
          // .select("enrollment status removed")
          .lean()
      : [];
    // console.log(attRegular, "attRegular");

//     const markedBeforeDay = await Attendance.find({
//   $expr: {
//     $lt: [
//       { $dateTrunc: { date: "$markedAt", unit: "day" } },
//       { $dateTrunc: { date: "$date", unit: "day" } }
//     ]
//   }
// });

// console.log(markedBeforeDay, "markedBeforeDay");


    const attByEnrollment = new Map(
      attRegular.map((a) => [String(a.enrollment), a])
    );

    // 6) Resultado de regulares (con present)
    const resultRegular = regularActive
      .filter((s) => !attByEnrollment.get(s.enrollmentId)?.removed)
      .map((s) => ({
        _id: s.id,
        name: s.name,
        enrollmentId: s.enrollmentId,
        present: attByEnrollment.get(s.enrollmentId)?.status === "presente",
        origin: "regular",
        payState: s.payState,
        paid: s.paid === true,
      }));

    // 7) Resultado de reprogramados IN (con present si hay asistencia REGULAR por enrollment)
    const resultResIn = rescheduleIn.map((s) => ({
      _id: s.id,
      name: s.name,
      enrollmentId: s.enrollmentId || null,
      present: s.enrollmentId
        ? attByEnrollment.get(s.enrollmentId)?.status === "presente"
        : false,
      origin: "reschedule-in",
      payState: s.payState,
      paid: s.paid === true,
    }));

    // 8) AD-HOC de ese día y slot (se mantiene igual)
    const adhocAttendances = await Attendance.find({
      date: { $gte: dayStart, $lte: dayEnd },
      branch: branchId,
      professor: professorId,
      origin: "adhoc",
      removed: { $ne: true },
      "slotSnapshot.dayOfWeek": dayOfWeek,
      "slotSnapshot.startMin": startMin,
      "slotSnapshot.endMin": endMin,
    })
      .select("student status")
      .populate("student", "name")
      .lean();

    const resultAdhoc = adhocAttendances.map((a) => ({
      _id: String(a.student?._id),
      name: a.student?.name,
      enrollmentId: a?.enrollment?._id ? String(a.enrollment._id) : null,
      present: a.status === "presente",
      origin: "adhoc",
      payState: a?.enrollment?.pay2?.state || a?.enrollment?.pay?.state || null,
      paid:
        a?.enrollment?.pay2?.state === "pagado" ||
        a?.enrollment?.pay?.state === "pagado",
    }));

    // 9) Combinar
    return NextResponse.json({
      students: [...resultRegular, ...resultResIn, ...resultAdhoc],
    });
  } catch (err) {
    console.error("GET /classes error:", err);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}

// ----------------------- PATCH -----------------------
export async function PATCH(req, { params }) {
  try {
    await dbConnect();
    const { branchId } = await params;
    const {
      enrollmentId,
      studentId,
      professorId,
      start,
      present,
      origin,
      slot,
    } = await req.json();

    if (!start)
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
    const date = new Date(start);

    let slotSnapshot = null;
    if (slot) {
      const { dayOfWeek, startMin, endMin } = parseSlot(slot);
      slotSnapshot = { dayOfWeek, startMin, endMin };
    }

    if (enrollmentId && (!origin || origin === "regular")) {
      await Attendance.findOneAndUpdate(
        { enrollment: enrollmentId, date },
        {
          enrollment: enrollmentId,
          student: studentId,
          professor: professorId,
          branch: branchId,
          date,
          status: present ? "presente" : "ausente",
          removed: false,
          origin: "regular",
          ...(slotSnapshot ? { slotSnapshot } : {}),
        },
        { upsert: true, setDefaultsOnInsert: true, runValidators: true }
      );
      return NextResponse.json({ ok: true });
    }

    if (origin === "adhoc" && studentId && professorId) {
      await Attendance.findOneAndUpdate(
        {
          student: studentId,
          professor: professorId,
          branch: branchId,
          date,
          origin: "adhoc",
        },
        {
          $set: {
            student: studentId,
            professor: professorId,
            branch: branchId,
            date,
            status: present ? "presente" : "ausente",
            removed: false,
            origin: "adhoc",
            ...(slotSnapshot ? { slotSnapshot } : {}),
          },
        },
        { upsert: true, setDefaultsOnInsert: true, runValidators: true }
      );
      return NextResponse.json({ ok: true });
    }
    if (origin === "reschedule-in" && studentId && professorId) {
      // intentar resolver enrollment si no vino
      let targetEnrollmentId = enrollmentId || null;
      if (!targetEnrollmentId) {
        const y = date.getUTCFullYear();
        const m = date.getUTCMonth() + 1;
        const en = await Enrollment.findOne({
          student: studentId,
          year: y,
          month: m,
          $or: [{ state: "activa" }, { estado: "activa" }],
        })
          .select("_id")
          .lean();
        if (en) targetEnrollmentId = String(en._id);
      }

      if (targetEnrollmentId) {
        // Guardamos como regular (sigue siendo una clase de la inscripción)
        await Attendance.findOneAndUpdate(
          { enrollment: targetEnrollmentId, date },
          {
            enrollment: targetEnrollmentId,
            student: studentId,
            professor: professorId, // puede ser otro profe (toProfessor)
            branch: branchId,
            date,
            status: present ? "presente" : "ausente",
            removed: false,
            origin: "regular", // importante para que cuente como clase regular
            ...(slotSnapshot ? { slotSnapshot } : {}),
          },
          { upsert: true, setDefaultsOnInsert: true, runValidators: true }
        );
        return NextResponse.json({ ok: true });
      }

      // Si no pudimos vincularla a una inscripción por algún motivo extraño,
      // caemos a AD-HOC para no romper el flujo (opcional)
      await Attendance.findOneAndUpdate(
        {
          student: studentId,
          professor: professorId,
          branch: branchId,
          date,
          origin: "adhoc",
        },
        {
          $set: {
            student: studentId,
            professor: professorId,
            branch: branchId,
            date,
            status: present ? "presente" : "ausente",
            removed: false,
            origin: "adhoc",
            ...(slotSnapshot ? { slotSnapshot } : {}),
          },
          $unset: { enrollment: "" },
        },
        { upsert: true, setDefaultsOnInsert: true, runValidators: true }
      );
      return NextResponse.json({ ok: true, fallback: "adhoc" });
    }
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  } catch (err) {
    console.error("PATCH /classes error:", err);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}

// ----------------------- DELETE -----------------------
export async function DELETE(req, { params }) {
  try {
    await dbConnect();
    const { branchId } = await params;

    const {
      enrollmentId,
      studentId,
      professorId,
      start,
      origin,
      slot, // 👈 traer del front si lo tenés
    } = await req.json();

    if (!start) {
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
    }
    const date = new Date(start);

    // ---------- REGULAR ----------
    if (enrollmentId && (!origin || origin === "regular")) {
      // 1) Intentar snapshot desde `slot`
      let snapshot = null;
      let profId = professorId || null;
      let studId = studentId || null;
      let brId = branchId;

      const parsed = parseSlot(slot);
      if (parsed) {
        snapshot = {
          dayOfWeek: parsed.dayOfWeek,
          startMin: parsed.startMin,
          endMin: parsed.endMin,
        };
        profId = profId || parsed.professorId;
      }

      // 2) Si no hay snapshot, derivarlo de la Enrollment (dow + startMin)
      if (!snapshot || !profId || !studId) {
        const en = await Enrollment.findById(enrollmentId)
          .select("student professor branch chosenSlots")
          .lean();

        if (en) {
          studId = studId || String(en.student);
          profId = profId || String(en.professor);
          brId = brId || String(en.branch);

          if (!snapshot) {
            const dow = dayOfWeekUTC(date);
            const sMin = startMinUTC(date);
            const slotMatch = (en.chosenSlots || []).find(
              (s) => s.dayOfWeek === dow && s.startMin === sMin
            );
            if (slotMatch) {
              snapshot = {
                dayOfWeek: slotMatch.dayOfWeek,
                startMin: slotMatch.startMin,
                endMin: slotMatch.endMin,
              };
            }
          }
        }
      }

      const update = {
        removed: true,
        origin: "regular",
        ...(snapshot ? { slotSnapshot: snapshot } : {}),
        ...(studId ? { student: studId } : {}),
        ...(profId ? { professor: profId } : {}),
        ...(brId ? { branch: brId } : {}),
      };

      await Attendance.findOneAndUpdate(
        { enrollment: enrollmentId, date }, // índice único regular
        { $set: update },
        { upsert: true, setDefaultsOnInsert: true, runValidators: true }
      );

      return NextResponse.json({ ok: true });
    }

    // ---------- AD-HOC ----------
    if (origin === "adhoc" && studentId && professorId) {
      // Guardar snapshot si viene `slot` (útil para el conteo por día/slot)
      const parsed = parseSlot(slot);
      const snapshot = parsed
        ? {
            dayOfWeek: parsed.dayOfWeek,
            startMin: parsed.startMin,
            endMin: parsed.endMin,
          }
        : undefined;

      await Attendance.findOneAndUpdate(
        {
          student: studentId,
          professor: professorId,
          branch: branchId,
          date,
          origin: "adhoc",
        }, // índice único adhoc incluye origin
        {
          $set: {
            removed: true,
            ...(snapshot ? { slotSnapshot: snapshot } : {}),
          },
          $unset: { enrollment: "" }, // por las dudas
        },
        { upsert: true, setDefaultsOnInsert: true, runValidators: true }
      );
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  } catch (err) {
    console.error("DELETE /classes error:", err);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}

// ----------------------- POST -----------------------
// Agrega alumno a la clase (si no tiene el slot, lo agrega a su Enrollment o crea uno nuevo)
// Luego crea la asistencia del día (por defecto en "ausente"; ajusta si querés marcar presente)

export async function POST(req, { params }) {
  try {
    await dbConnect();
    const { branchId } = await params;
    const { email, start, slot, adhoc } = await req.json();
    if (!email || !start || !slot) {
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
    }

    const date = new Date(start);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const { professorId, dayOfWeek, startMin, endMin } = parseSlot(slot);
    const slotSnapshot = { dayOfWeek, startMin, endMin }; // 👈

    const student = await User.findOne({ email }).select("_id name").lean();
    if (!student) {
      return NextResponse.json(
        { error: "Estudiante no encontrado" },
        { status: 404 }
      );
    }
    let enrollment = null;
    if (adhoc === "false") {
      enrollment = await Enrollment.findOne({
        student: student._id,
        branch: branchId,
        professor: professorId,
        year,
        month,
        $or: [{ state: "activa" }, { estado: "activa" }],
        chosenSlots: { $elemMatch: { dayOfWeek, startMin, endMin } },
      })
        .select("_id student")
        .populate("student", "name")
        .lean();
    } else {
      enrollment = await AdhocClass.findOne({
        student: student._id,
        branch: branchId,
        professor: professorId,
        year,
        month,
        $or: [{ state: "activa" }, { estado: "activa" }],
        chosenSlots: { $elemMatch: { dayOfWeek, startMin, endMin } },
      })
        .select("_id student")
        .populate("student", "name")
        .lean();
    }
    // ¿tiene inscripción REGULAR ese mes y slot?

    if (enrollment) {
      const updateData = {
        student: enrollment ? enrollment.student._id : student.id, // si es adhoc puede venir studentId directamente
        professor: professorId,
        branch: branchId,
        date,
        status: "ausente", // o "presente" según corresponda
        removed: false,
        origin: enrollment ? "regular" : "adhoc",
        slotSnapshot,
      };

      if (adhoc === "true") {
        updateData.adhocClass = enrollment._id;
      } else {
        updateData.enrollment = enrollment._id;
      }

      const filter =
        adhoc === "true"
          ? { adhocClass: enrollment._id }
          : { enrollment: enrollment._id };

      await Attendance.findOneAndUpdate(filter, updateData, {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      });

      return NextResponse.json({
        student: {
          _id: String(enrollment.student._id),
          name: enrollment.student.name,
          enrollmentId: String(enrollment._id),
          present: false,
          origin: "regular",
        },
      });
    }

    // Si NO tiene ese slot → crear/actualizar asistencia AD-HOC (sin tocar Enrollment)
    const attAdhoc = await Attendance.findOneAndUpdate(
      {
        student: student._id,
        professor: professorId,
        branch: branchId,
        date,
        origin: "adhoc",
      },
      {
        $set: {
          student: student._id,
          professor: professorId,
          branch: branchId,
          date,
          status: "ausente", // o "presente" si querés marcar llegada directa
          removed: false,
          origin: "adhoc",
          slotSnapshot,
        },
        $unset: { enrollment: "" }, // por si algún registro viejo tenía null
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
        runValidators: true,
      }
    );

    return NextResponse.json({
      student: {
        _id: String(student._id),
        name: student.name || email,
        enrollmentId: null,
        present: attAdhoc.status === "presente",
        origin: "adhoc",
      },
    });
  } catch (err) {
    console.error("POST /classes error:", err);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}
