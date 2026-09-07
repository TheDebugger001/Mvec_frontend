import { client } from "./client";

export const cartApi = {
  get: () =>
    client.get("/cart").then((r) => r.data.cart),
  add: (productId, quantity = 1) =>
    client.post("/cart", { productId, quantity }).then((r) => r.data),
  updateQuantity: (productId, quantity) =>
    client.put(`/cart/items/${productId}`, { quantity }).then((r) => r.data),
  remove: (productId) =>
    client.delete(`/cart/items/${productId}`).then((r) => r.data),
  clear: () =>
    client.delete("/cart").then((r) => r.data),
};
