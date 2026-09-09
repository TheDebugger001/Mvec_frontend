import { client } from "./client";

export const promotionsApi = {
  getAll: (params) =>
    client.get("/promotions", { params }).then((r) => r.data),
  create: (payload) =>
    client.post("/promotions", payload).then((r) => r.data),
  update: (id, payload) =>
    client.patch(`/promotions/${id}`, payload).then((r) => r.data),
  remove: (id) =>
    client.delete(`/promotions/${id}`).then((r) => r.data),
};
