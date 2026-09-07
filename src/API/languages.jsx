import { client } from "./client";

export const languagesApi = {
  getAll: () =>
    client.get("/languages").then((r) => r.data),
};
