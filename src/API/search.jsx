import { client } from "./client";

export const searchApi = {
  search: (params) =>
    client.get("/search", { params }).then((r) => r.data),
  getSuggestions: (q) =>
    client.get("/search/suggestions", { params: { q } }).then((r) => r.data),
  getHomeFeed: () =>
    client.get("/search/home").then((r) => r.data),
};
