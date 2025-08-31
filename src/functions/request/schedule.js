import api from "@/lib/axios";

// ✅ Un profesor (requiere professorId)
export async function fetchProfessorMonthEvents({ professorId, year, month }) {
  const { data } = await api.get("/calendar/professor", {
    params: { professorId, year, month },
  });
  return data; // { events }
}

// ✅ Todos los profesores
export async function fetchAllProfessorsMonthEvents({ year, month }) {
  const { data } = await api.get("/calendar", { params: { year, month } });
  return data; // { events }
}

export async function fetchEnrollmentsByStudent(studentId, branchId) {
  const { data } = await api.get(
    `${branchId}/enrollments/by-student/${studentId}`
  );
  return data; // { enrollments }
}

export async function saveCurrentMonthSlots({
  enrollmentId,
  chosenSlots,
  professorId,
}) {
  const { data } = await api.post(`/enrollments/${enrollmentId}/slots`, {
    chosenSlots,
    professorId,
  });
  return data;
}

export async function saveNextMonthSlots({
  studentId,
  professorId,
  year,
  month,
  chosenSlots,
  asStudent = false,
}) {
  const { data } = await api.post(`/enrollments/upsert-next`, {
    studentId,
    professorId,
    year,
    month,
    chosenSlots,
    asStudent,
  });
  return data;
}

export async function rescheduleSingleClass({
  enrollmentId,
  fromDateISO,
  toProfessorId,
  toSlot,
}) {
  const { data } = await api.post(`/enrollments/student-reschedules`, {
    enrollmentId,
    fromDate: fromDateISO,
    toProfessorId,
    slotTo: toSlot,
  });
  return data;
}

export async function fetchRescheduleOptions({
  enrollmentId,
  fromDateISO,
  toProfessorId,
  branchId,
}) {
  const params = { enrollmentId, from: fromDateISO };
  if (toProfessorId) params.toProfessorId = toProfessorId;
  const { data } = await api.get(`${branchId}/enrollments/student-reschedules/options`, {
    params,
  });
  return data; // { options: [...] }
}
