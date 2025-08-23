import api from "@/lib/axios";

export async function fetchProfessorMonthEvents({ year, month }) {
  // GET /calendar
  const { data } = await api.get("/calendar", { params: { year, month } });
  return data; // { events }
}
export async function fetchAllProfessorsMonthEvents({ year, month }) {
  // GET /calendar/professors
  const { data } = await api.get("/calendar/professors", {
    params: { year, month },
  });
  return data; // { events }
}
export async function fetchEnrollmentsByStudent(studentId) {
  const { data } = await api.get(`/enrollments/by-student/${studentId}`);
  return data; // { enrollments }
}
export async function saveCurrentMonthSlots({ enrollmentId, chosenSlots }) {
  console.log(enrollmentId, chosenSlots, "saveCurrentMonthSlots");
  
  const { data } = await api.patch(`/enrollments/${enrollmentId}/slots`, {
    chosenSlots,
    assignNow: false,
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
    assignNow: false,
    asStudent,
  });
  return data;
}
// Reprogramar UNA clase — usa tu ruta real /api/student-reschedules
export async function rescheduleSingleClass({
  enrollmentId,
  fromDateISO,
  toProfessorId,
  toSlot,
  toDateISO,
  motivo,
}) {
  const payload = {
    enrollmentId,
    fromDate: fromDateISO,
    toDate: toDateISO,
    slotTo: toSlot,
    motivo: motivo || "",
  };
  if (toProfessorId) payload.toProfessorId = toProfessorId; // si cambiás de profe
  const { data } = await api.post("/api/student-reschedules", payload);
  return data; // { ok, rescheduleId }
}

export async function fetchRescheduleOptions({
  enrollmentId,
  fromDateISO,
  toProfessorId,
}) {
  const params = { enrollmentId, from: fromDateISO };
  if (toProfessorId) params.toProfessorId = toProfessorId; // si querés cambiar profe
  const { data } = await api.get("/api/student-reschedules/options", {
    params,
  });
  return data; // { options: [...] }
}
