import api from "@/lib/axios";

export async function fetchStudents({ q = "", page = 1, limit = 10, state = "all" } = {}) {
  const params = { page, limit };
  if (q) params.q = q;
  if (state && state !== "all") params.state = state; // 'active' | 'inactive'
  const { data } = await api.get("/students", { params });
  return data; // { items, page, limit, total, totalPages }
}