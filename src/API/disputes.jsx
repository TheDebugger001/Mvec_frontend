import { client } from "./client";

export const disputesApi = {
  open: (payload) =>
    client.post("/disputes", payload).then((r) => r.data),
  submitEvidence: (disputeId, payload) =>
    client.post(`/disputes/${disputeId}/evidence`, payload).then((r) => r.data),
  arbitrate: (disputeId, payload) =>
    client.post(`/disputes/${disputeId}/arbitrate`, payload).then((r) => r.data),
};
