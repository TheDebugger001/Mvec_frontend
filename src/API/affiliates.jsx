import { client } from "./client";

export const affiliatesApi = {
  generateLink: (payload) =>
    client.post("/affiliates/links", payload).then((r) => r.data),
  trackClick: (code) =>
    client.get(`/affiliates/track/${code}`).then((r) => r.data),
  requestPayout: (payload) =>
    client.post("/affiliates/payouts/request", payload).then((r) => r.data),
};
