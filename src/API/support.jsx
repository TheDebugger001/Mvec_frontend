import { client } from "./client";

export const supportApi = {
  createCase: (payload) =>
    client.post("/support/cases", payload).then((r) => r.data),
  getCaseById: (id) =>
    client.get(`/support/cases/${id}`).then((r) => r.data),
  addComment: (caseId, payload) =>
    client.post(`/support/cases/${caseId}/comments`, payload).then((r) => r.data),
};
