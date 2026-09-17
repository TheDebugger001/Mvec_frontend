import { client } from "./client";

export const suppliersApi = {
  getAll: (params) =>
    client.get("/suppliers", { params }).then((r) => r.data),
  getByIdOrSlug: (idOrSlug) =>
    client.get(`/suppliers/${idOrSlug}`).then((r) => r.data),
  getProducts: (id) =>
    client.get(`/suppliers/${id}/products`).then((r) => r.data),
  onboard: (payload) =>
    client.post("/suppliers/onboard", payload).then((r) => r.data),
  getMyProfile: () =>
    client.get("/suppliers/me/profile").then((r) => r.data),
  updateMyProfile: (payload) =>
    client.patch("/suppliers/me/profile", payload).then((r) => r.data),
  getMyProducts: () =>
    client.get("/suppliers/me/products").then((r) => r.data),
  createMyProduct: (payload) =>
    client.post("/suppliers/me/products", payload).then((r) => r.data),
  updateMyProduct: (id, payload) =>
    client.put(`/suppliers/me/products/${id}`, payload).then((r) => r.data),
  deleteMyProduct: (id) =>
    client.delete(`/suppliers/me/products/${id}`).then((r) => r.data),
};
