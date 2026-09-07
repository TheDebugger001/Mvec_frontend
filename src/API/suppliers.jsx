import { client } from "./client";

export const suppliersApi = {
  getAll: (params) =>
    client.get("/suppliers", { params }).then((r) => r.data),
  getByIdOrSlug: (idOrSlug) =>
    client.get(`/suppliers/${idOrSlug}`).then((r) => r.data),
  onboard: (payload) =>
    client.post("/suppliers/onboard", payload).then((r) => r.data),
  getMyProfile: () =>
    client.get("/suppliers/me/profile").then((r) => r.data),
  updateMyProfile: (payload) =>
    client.patch("/suppliers/me/profile", payload).then((r) => r.data),
};
