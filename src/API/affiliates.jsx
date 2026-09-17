import { client } from "./client";

export const affiliatesApi = {
  generateLink: (payload) =>
    client.post("/affiliates/links", payload).then((r) => r.data),
  trackClick: (code) =>
    client.get(`/affiliates/track/${code}`).then((r) => r.data),
  requestPayout: (payload) =>
    client.post("/affiliates/payouts/request", payload).then((r) => r.data),
  getMyDashboard: () =>
    client.get("/affiliates/me/dashboard").then((r) => r.data),
  adminList: () =>
    client.get("/affiliates").then((r) => r.data),
  getMyPayouts: () =>
    client.get("/affiliates/payouts").then((r) => r.data),
  getMyConversions: () =>
    client.get("/affiliates/conversions").then((r) => r.data),
  adminListPayouts: () =>
    client.get("/affiliates/admin/payouts").then((r) => r.data),
};
