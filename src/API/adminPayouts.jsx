import { client } from "./client";

export const adminPayoutsApi = {
  getBalance: () =>
    client.get("/admin/payouts/balance").then((r) => r.data),
  requestPayout: (payload) =>
    client.post("/admin/payouts/request", payload).then((r) => r.data),
  getHistory: () =>
    client.get("/admin/payouts/history").then((r) => r.data),
};
