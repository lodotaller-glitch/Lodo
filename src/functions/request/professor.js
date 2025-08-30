import api from "@/lib/axios";

export async function fetchBranchProfessors({
  q = "",
  page = 1,
  limit = 10,
  state = "all",
  branch,
} = {}) {
  const params = { page, limit, branch };
  if (q) params.q = q;
  if (state && state !== "all") params.state = state; // 'active' | 'inactive'
  const { data } = await api.get(`/${branch}/professors`, { params });
  return data; // { professors }
}
export async function createProfessorInBranch(branchId, payload) {
  const { data } = await api.post(
    `/api/branches/${branchId}/professors`,
    payload
  );
  return data;
}

// Actualizar el horario de un profesor
export async function updateProfessorSchedule(branchId, professorId, data) {
  const response = await fetch(
    `/api/${branchId}/professors/${professorId}/schedule`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }
  );
  if (!response.ok)
    throw new Error("Error al actualizar el horario del profesor");
  return response.json();
}

export async function fetchProfessorById(branchId, professorId) {
  const { data } = await api.get(`${branchId}/professors/${professorId}`);
  return data;
}
export async function updateProfessor(branchId, professorId, { professor }) {
  const { data } = await api.put(`${branchId}/professors/${professorId}`, {
    ...professor,
  });
  return data;
}

export async function getProfessorMonthSchedule(
  professorId,
  { year, month, branchId }
) {
  const { data } = await api.get(
    `/${branchId}/professors/${professorId}/schedule`,
    {
      params: { year, month },
    }
  );
  return data;
}
export async function updateProfessorMonthSchedule(professorId, payload) {
  const { data } = await api.post(
    `/api/professors/${professorId}/schedule/update-month`,
    payload
  );
  return data; // { ok, scheduleId, reassigned, changes }
}
