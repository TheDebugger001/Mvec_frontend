import { client } from "./client";

export const paymentsApi = {
  initiateMoMo: (payload) =>
    client.post("/payments/pay/momo", payload).then((r) => r.data),
  initiateAirtel: (payload) =>
    client.post("/payments/pay/airtel", payload).then((r) => r.data),
};
