import { client } from "./client";

export const wholesaleApi = {
  createOrder: (payload) =>
    client.post("/wholesale/orders", payload).then((r) => r.data),
  holdEscrow: (orderId, payload) =>
    client.post(`/wholesale/orders/${orderId}/hold-escrow`, payload).then((r) => r.data),
  confirmReceipt: (orderId) =>
    client.post(`/wholesale/orders/${orderId}/confirm-receipt`).then((r) => r.data),
};
