import { client } from "./client";

export const categoriesApi = {
  getAll: (params) =>
    client.get("/categories", { params }).then((r) => r.data),
  getBySlug: (slug) =>
    client.get(`/categories/${slug}`).then((r) => r.data),
  create: (payload) =>
    client.post("/categories", payload).then((r) => r.data),
  update: (id, payload) =>
    client.patch(`/categories/${id}`, payload).then((r) => r.data),
  delete: (id) =>
    client.delete(`/categories/${id}`).then((r) => r.data),
};
