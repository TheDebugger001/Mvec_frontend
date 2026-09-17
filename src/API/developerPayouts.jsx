import { client } from "./client";

export const developerPayoutsApi = {
  getBalance: () =>
    client.get("/developer/payouts/balance").then((r) => r.data),
  requestPayout: (payload) =>
    client.post("/developer/payouts/request", payload).then((r) => r.data),
  getHistory: () =>
    client.get("/developer/payouts/history").then((r) => r.data),
};
