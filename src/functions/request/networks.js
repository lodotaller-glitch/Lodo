import api from "@/lib/axios";

export async function fetchNetworks({
  q = "",
  page = 1,
  limit = 10,
  state = "all",
  branch,
} = {}) {
  const params = { page, limit, branch };
  if (q) params.q = q;
  if (state && state !== "all") params.state = state;
  const { data } = await api.get(`/${branch}/networks`, { params });
  return data;
}