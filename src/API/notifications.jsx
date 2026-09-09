import { client } from "./client";

export const notificationsApi = {
  create: (payload) =>
    client.post("/notifications", payload).then((r) => r.data),
  getMine: (params) =>
    client.get("/notifications/mine", { params }).then((r) => r.data),
  markRead: (id) =>
    client.patch(`/notifications/${id}/read`).then((r) => r.data),
  markAllRead: () =>
    client.post("/notifications/read-all").then((r) => r.data),
  getAdmin: (params) =>
    client.get("/notifications", { params }).then((r) => r.data),
};
