import { client } from "./client";

export const abuseReportsApi = {
  getMine: (params) =>
    client.get("/abuse-reports", { params }).then((r) => r.data),
  getById: (id) =>
    client.get(`/abuse-reports/${id}`).then((r) => r.data),
  submit: (payload) =>
    client.post("/abuse-reports", payload).then((r) => r.data),
  update: (id, payload) =>
    client.patch(`/abuse-reports/${id}`, payload).then((r) => r.data),
};