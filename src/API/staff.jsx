import { client } from "./client";

export const staffApi = {
  add: (payload) =>
    client.post("/staff", payload).then((r) => r.data),
  getAll: () =>
    client.get("/staff").then((r) => r.data),
  update: (id, payload) =>
    client.put(`/staff/${id}`, payload).then((r) => r.data),
  remove: (id) =>
    client.delete(`/staff/${id}`).then((r) => r.data),
};
