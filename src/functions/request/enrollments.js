import api from "@/lib/axios";

export async function getEnrollmentsByStudent(studentId) {
  const { data } = await api.get(`/enrollments/by-student/${studentId}`);
  return data;
}

export async function getProfessorSlotsForMonth(professorId, year, month) {
  const { data } = await api.get(`/professors/${professorId}/slots`, {
    params: { year, month },
  });
  return data; // { slots: [{dayOfWeek,startMin,endMin}] }
}
export async function getProfessorSlots(year, month) {
  const { data } = await api.get("/professors/slots", {
    params: { year, month },
  });
  return data; // { slots: [...] } (filtrados por ese profesor)
}
export async function updateEnrollmentSlots(
  enrollmentId,
  chosenSlots,
  assignNow
) {
  const { data } = await api.patch(`/enrollments/${enrollmentId}/slots`, {
    chosenSlots,
    assignNow,
  });
  return data; // { ok:true }
}

export async function upsertNextMonthEnrollment({
  studentId,
  professorId,
  year,
  month,
  chosenSlots,
  assignNow,
}) {
  const { data } = await api.post(`/enrollments/upsert-next`, {
    studentId,
    professorId,
    year,
    month,
    chosenSlots,
    assignNow,
  });
  return data; // { ok, enrollmentId }
}

export async function getEnrollmentOccurrences(enrollmentId) {
  const { data } = await api.get(`/enrollments/${enrollmentId}/occurrences`);
  return data; // { occurrences: [{start, end, slot}] }
}

export async function getRescheduleOptions({ enrollmentId, fromDateISO }) {
  const { data } = await api.get(`/enrollments/student-reschedules/options`, {
    params: { enrollmentId, from: fromDateISO },
  });
  return data; // { options: [{to,startISO,endISO, slotTo, status, capacityLeft}] }
}

export async function createOrUpdateReschedule({
  enrollmentId,
  fromDateISO,
  toDateISO,
  slotTo,
  motivo,
}) {
  const { data } = await api.post(`/enrollments/student-reschedules`, {
    enrollmentId,
    fromDate: fromDateISO,
    toDate: toDateISO,
    slotTo,
    motivo,
  });
  return data; // { ok:true }
}
