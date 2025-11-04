import { NextResponse as __NR } from "next/server";
import dbConnect from "@/lib/dbConnect";
import { Enrollment, ProfessorSchedule, User } from "@/models";

export async function POST(req, { params }) {
  try {
    await dbConnect();
    const {
      studentId,
      professorId,
      year,
      month,
      chosenSlots = [],
      assignNow = true,
      asStudent = false,
    } = await req.json();

    const { branchId } = await params;

    if (!studentId || !professorId || !year || !month)
      return __NR.json({ error: "Faltan parámetros" }, { status: 400 });

    // Si viene asStudent, aplicar reglas estrictas:
    if (asStudent) {
      // Debe estar dentro de los últimos 5 días del mes actual (zona local del server, ajustá si usás TZ AR)
      const now = new Date();
      const end = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
        999
      );
      const daysLeft = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
      if (daysLeft > 5) {
        return __NR.json(
          {
            error:
              "Solo podés cambiar el mes siguiente dentro de los últimos 5 días del mes actual.",
          },
          { status: 403 }
        );
      }
      // Y solo el mes siguiente al actual
      const nm =
        now.getMonth() === 11
          ? { y: now.getFullYear() + 1, m: 1 }
          : { y: now.getFullYear(), m: now.getMonth() + 1 + 1 };
      if (Number(year) !== nm.y || Number(month) !== nm.m) {
        return __NR.json(
          { error: "Solo se permite modificar el mes siguiente." },
          { status: 403 }
        );
      }
    }

    if (
      !Array.isArray(chosenSlots) ||
      chosenSlots.length < 1 ||
      chosenSlots.length > 2
    )
      return __NR.json(
        { error: "Debés elegir 1 o 2 franjas" },
        { status: 400 }
      );
    const targetProfessor = chosenSlots[0]?.professorId || professorId;
    const start = new Date(Date.UTC(year, month - 1, 1));
    const sched = await ProfessorSchedule.findActiveForDate(
      targetProfessor,
      start
    );
    if (!sched)
      return __NR.json(
        { error: "Profesor sin horario vigente" },
        { status: 400 }
      );
    const key = (s, professorId) =>
      `${professorId}-${s.dayOfWeek}-${s.startMin}-${s.endMin}`;

    const setSched = new Set(sched.slots.map((s) => key(s, sched.professor)));

    for (const s of chosenSlots) {
      if (!setSched.has(key(s, s.professorId)))
        return __NR.json(
          { error: "Franja inexistente en el mes" },
          { status: 409 }
        );
    }

    let en = await Enrollment.findOne({
      student: studentId,
      professor: targetProfessor,
      year,
      month,
      state: "activa",
    });
    if (!en) {
      // validar cupo si assignNow
      if (assignNow) {
        const prof = await User.findById(targetProfessor).lean();
        const capacity = Math.max(1, Number(prof?.capacity ?? 10));
        for (const s of chosenSlots) {
          const same = await Enrollment.countDocuments({
            professor: targetProfessor,
            year,
            month,
            state: "activa",
            assigned: true,
            chosenSlots: { $elemMatch: s },
          });
          if (same >= capacity)
            return __NR.json(
              { error: "Sin cupo en alguna franja" },
              { status: 409 }
            );
        }
      }
      en = await Enrollment.create({
        student: studentId,
        professor: targetProfessor,
        branch: branchId,
        year,
        month,
        chosenSlots,
        state: "activa",
        assigned: Boolean(assignNow),
      });
      await User.updateOne({ _id: studentId }, { $inc: { clayKg: 1.5 } });
    } else {
      // actualizar slots de la existente
      if (en.assigned || assignNow) {
        const prof = await User.findById(targetProfessor).lean();
        const capacity = Math.max(1, Number(prof?.capacity ?? 10));
        for (const s of chosenSlots) {
          const same = await Enrollment.countDocuments({
            professor: targetProfessor,
            year,
            month,
            state: "activa",
            assigned: true,
            chosenSlots: { $elemMatch: s },
            _id: { $ne: en._id },
          });
          if (same >= capacity)
            return __NR.json(
              { error: "Sin cupo en alguna franja" },
              { status: 409 }
            );
        }
      }
      en.chosenSlots = chosenSlots;
      if (assignNow) en.assigned = true;
      await en.save();
    }
    return __NR.json({ ok: true, enrollmentId: en._id });
  } catch (err) {
    console.error("POST /enrollments/upsert-next", err);
    return __NR.json(
      { error: "Error del servidor", details: err?.message },
      { status: 500 }
    );
  }
}
