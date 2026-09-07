import { client } from "./client";

export const storesApi = {
  getPublicBySlug: (slug) =>
    client.get(`/stores/public/${slug}`).then((r) => r.data),
  getMyStore: () =>
    client.get("/stores/mine").then((r) => r.data),
  create: (payload) =>
    client.post("/stores", payload).then((r) => r.data),
  update: (payload) =>
    client.put("/stores/mine", payload).then((r) => r.data),
};
