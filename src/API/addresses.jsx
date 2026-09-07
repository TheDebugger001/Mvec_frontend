import { client } from "./client";

export const addressesApi = {
  getAll: () =>
    client.get("/auth/addresses").then((r) => r.data),
  add: (payload) =>
    client.post("/auth/addresses", payload).then((r) => r.data),
  update: (addressId, payload) =>
    client.put(`/auth/addresses/${addressId}`, payload).then((r) => r.data),
  remove: (addressId) =>
    client.delete(`/auth/addresses/${addressId}`).then((r) => r.data),
};
