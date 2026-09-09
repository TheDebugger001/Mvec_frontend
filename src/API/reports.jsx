import { client } from "./client";

export const reportsApi = {
  getSummary: (params) =>
    client.get("/reports/summary", { params }).then((r) => r.data),
  getRevenueSeries: (params) =>
    client.get("/reports/revenue", { params }).then((r) => r.data),
};
