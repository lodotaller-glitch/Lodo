import api from "@/lib/axios";

export async function getEnrollmentsByStudent(studentId, branchId) {
  const { data } = await api.get(
    `/${branchId}/enrollments/by-student/${studentId}`
  );
  return data;
}

export async function getProfessorSlotsForMonth(
  professorId,
  year,
  month,
  branchId
) {
  const { data } = await api.get(
    `/${branchId}/professors/${professorId}/slots`,
    {
      params: { year, month },
    }
  );
  return data; // { slots: [{dayOfWeek,startMin,endMin}] }
}
export async function getProfessorSlots(year, month, branchId) {
  const { data } = await api.get(`/${branchId}/professors/slots`, {
    params: { year, month },
  });

  return data; // { slots: [...] } (filtrados por ese profesor)
}
export async function updateEnrollmentSlots(
  enrollmentId,
  chosenSlots,
  assignNow,
  branchId
) {
  const { data } = await api.put(
    `/${branchId}/enrollments/${enrollmentId}/slots`,
    {
      chosenSlots,
      assignNow,
      professorId: chosenSlots[0]?.professorId,
    }
  );
  return data; // { ok:true }
}

export async function upsertNextMonthEnrollment({
  studentId,
  professorId,
  year,
  month,
  chosenSlots,
  assignNow,
  branchId,
}) {
  const { data } = await api.post(`/${branchId}/enrollments/upsert-next`, {
    studentId,
    professorId,
    year,
    month,
    chosenSlots,
    assignNow,
    branchId,
  });
  return data; // { ok, enrollmentId }
}

export async function getEnrollmentOccurrences(enrollmentId, branchId) {
  const { data } = await api.get(
    `/${branchId}/enrollments/${enrollmentId}/occurrences`
  );
  return data; // { occurrences: [{start, end, slot}] }
}

export async function getRescheduleOptions({
  enrollmentId,
  fromDateISO,
  branchId,
}) {
  const { data } = await api.get(
    `/${branchId}/enrollments/student-reschedules/options`,
    {
      params: { enrollmentId, from: fromDateISO },
    }
  );
  return data; // { options: [{to,startISO,endISO, slotTo, status, capacityLeft}] }
}

export async function createOrUpdateReschedule({
  enrollmentId,
  fromDateISO,
  toDateISO,
  toProfessorId,
  slotTo,
  motivo,
  slotFrom,
  branchId,
}) {
  const { data } = await api.post(
    `/${branchId}/enrollments/student-reschedules`,
    {
      enrollmentId,
      fromDate: fromDateISO,
      toDate: toDateISO,
      toProfessorId,
      slotFrom,
      slotTo,
      motivo,
    }
  );
  return data; // { ok:true }
}

export async function removeOccurrenceApi({
  branchId,
  enrollmentId,
  origin,
  attendanceId,
  rescheduleId,
}) {
  const { data } = await api.post(
    `/${branchId}/enrollments/${enrollmentId}/occurrences/remove`,
    { origin, attendanceId, rescheduleId }
  );

  if (!data.ok) throw new Error(data?.error || "No se pudo eliminar la clase");
  return data;
}
