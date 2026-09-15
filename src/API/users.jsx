import { client } from "./client";

export const usersApi = {
  getAll: (params) => client.get("/users", { params }).then((r) => r.data),
  getById: (id) => client.get(`/users/${id}`).then((r) => r.data),
  update: (id, payload) =>
    client.patch(`/users/${id}`, payload).then((r) => r.data),
  getVendorCustomers: () =>
    client.get("/users/vendor/customers").then((r) => r.data),
  search: (q, params = {}) =>
    client.get("/users/search", { params: { q, ...params } }).then((r) => r.data),
};
