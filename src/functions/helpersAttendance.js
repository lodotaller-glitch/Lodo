// helpers chiquitos
export function sameSlot(a, b) {
  if (!a || !b) return false;
  return a.dayOfWeek === b.dayOfWeek && a.startMin === b.startMin && a.endMin === b.endMin;
}

export async function syncAttendancesAfterReschedule({
  Attendance,
  en,            // enrollment doc (lean or plain)
  branchId,
  from,          // Date exacta de la clase original
  toFinal,       // Date exacta de la clase destino
  slotFrom,      // { dayOfWeek, startMin, endMin }  (puede ser null)
  slotTo,        // { dayOfWeek, startMin, endMin }
  rescheduleId,  // ObjectId de StudentReschedule
  fromProfessor, // ObjectId
  toProfessor,   // ObjectId
}) {
  // 1) Marcar la clase ORIGINAL como removida (regular y, por si acaso, ad-hoc)
  // REGULAR (usado por tu GET /classes)
  await Attendance.findOneAndUpdate(
    { enrollment: en._id, branch: branchId, date: from },
    {
      $set: {
        enrollment: en._id,
        student: en.student,
        professor: fromProfessor,
        branch: branchId,
        date: from,
        status: "reprogramado",
        removed: false,
        origin: "regular",
        reschedule: rescheduleId,
      },
    },
    { upsert: true, setDefaultsOnInsert: true }
  );

  // AD-HOC (si existiera una ad-hoc en el mismo from)
  await Attendance.findOneAndUpdate(
    {
      origin: "adhoc",
      student: en.student,
      professor: fromProfessor,
      branch: branchId,
      date: from,
      ...(slotFrom
        ? {
            "slotSnapshot.dayOfWeek": slotFrom.dayOfWeek,
            "slotSnapshot.startMin": slotFrom.startMin,
            "slotSnapshot.endMin": slotFrom.endMin,
          }
        : {}),
    },
    { $set: { removed: true, status: "reprogramado", reschedule: rescheduleId } },
    { upsert: false }
  );

  // 2) Crear/actualizar la clase DESTINO como AD-HOC (para que aparezca ese día)
  await Attendance.findOneAndUpdate(
    {
      origin: "adhoc",
      student: en.student,
      professor: toProfessor,
      branch: branchId,
      date: toFinal,
    },
    {
      $set: {
        student: en.student,
        professor: toProfessor,
        branch: branchId,
        date: toFinal,
        status: "ausente",      // o "presente" si querés marcar la llegada
        removed: false,
        origin: "adhoc",
        reschedule: rescheduleId,
        slotSnapshot: {
          dayOfWeek: slotTo.dayOfWeek,
          startMin: slotTo.startMin,
          endMin: slotTo.endMin,
        },
      },
      $unset: { enrollment: "" }, // importante para no chocar el índice regular
    },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
  );
}
