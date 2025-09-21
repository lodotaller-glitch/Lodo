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
export async function updateProfessorSchedule(
  branchId,
  professorId,
  { slots, applyFromYear, applyFromMonth }
) {
  const url = new URL(
    `/api/${branchId}/professors/${professorId}/schedule`,
    window.location.origin
  );
  if (applyFromYear)
    url.searchParams.set("applyFromYear", String(applyFromYear));
  if (applyFromMonth)
    url.searchParams.set("applyFromMonth", String(applyFromMonth));
  const res = await fetch(url.toString(), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slots }),
  });
  const data = await res.json();
  if (!res.ok)
    throw new Error(data?.error || "No se pudo actualizar el horario");
  return data;
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

export async function deleteProfessor(branchId, professorId) {
  const { data } = await api.delete(`/${branchId}/professors/${professorId}`);

  if (!data.ok)
    throw new Error(data?.error || "No se pudo eliminar el profesor");
  return data;
}
