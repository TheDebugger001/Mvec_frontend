import { client } from "./client";

export const payoutsApi = {
  getBalance: () =>
    client.get("/payouts/balance").then((r) => r.data),
  requestPayout: (payload) =>
    client.post("/payouts/request", payload).then((r) => r.data),
  getHistory: () =>
    client.get("/payouts/history").then((r) => r.data),
};
