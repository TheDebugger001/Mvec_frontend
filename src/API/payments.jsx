import { client } from "./client";

export const paymentsApi = {
  initiateMoMo: (payload) =>
    client.post("/payments/momo/initiate", payload).then((r) => r.data),
  initiateAirtel: (payload) =>
    client.post("/payments/airtel/initiate", payload).then((r) => r.data),
};
