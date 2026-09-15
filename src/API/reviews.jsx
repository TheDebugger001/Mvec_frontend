import { client } from "./client";

export const reviewsApi = {
  create: (payload) => client.post("/reviews", payload).then((r) => r.data),
  getProductReviews: (productId, params) =>
    client.get(`/reviews/product/${productId}`, { params }).then((r) => r.data),
  getMine: (params) =>
    client.get("/reviews/mine", { params }).then((r) => r.data),
  getVendorReviews: () =>
    client.get("/reviews/vendor").then((r) => r.data),
  reply: (id, payload) =>
    client.post(`/reviews/${id}/reply`, payload).then((r) => r.data),
  getAdmin: (params) =>
    client.get("/reviews", { params }).then((r) => r.data),
  update: (id, payload) =>
    client.patch(`/reviews/${id}`, payload).then((r) => r.data),
  remove: (id) =>
    client.delete(`/reviews/${id}`).then((r) => r.data),
};
