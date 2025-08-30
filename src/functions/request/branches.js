import api from "@/lib/axios";

export async function fetchBranches() {
  const { data } = await api.get("/branches");
  return data; // { branches }
}
export async function createBranch(payload) {
  const { data } = await api.post("/branches", payload);
  return data;
}
