import { client } from "./client";

export const vendorsApi = {
  getAll: (params) =>
    client.get("/vendors", { params }).then((r) => r.data),
  getByIdOrSlug: (idOrSlug) =>
    client.get(`/vendors/${idOrSlug}`).then((r) => r.data),
  onboard: (payload) =>
    client.post("/vendors/onboard", payload).then((r) => r.data),
  getMyProfile: () =>
    client.get("/vendors/me/profile").then((r) => r.data),
  updateMyProfile: (payload) =>
    client.patch("/vendors/me/profile", payload).then((r) => r.data),
};
