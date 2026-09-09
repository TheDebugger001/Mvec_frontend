import { client } from "./client";

export const shippingApi = {
  getPublic: (params) =>
    client.get("/shipping/zones", { params }).then((r) => r.data),
  getMine: () =>
    client.get("/shipping/zones/mine").then((r) => r.data),
  create: (payload) =>
    client.post("/shipping/zones", payload).then((r) => r.data),
  update: (id, payload) =>
    client.patch(`/shipping/zones/${id}`, payload).then((r) => r.data),
  remove: (id) =>
    client.delete(`/shipping/zones/${id}`).then((r) => r.data),
};
