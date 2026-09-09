import { client } from "./client";

export const monetizationApi = {
  // ── Vendor subscription ──────────────────────────────────────────────
  getVendorSubscription: () =>
    client.get("/vendor/subscription").then((r) => r.data),
  upgradeVendorSubscription: (payload) =>
    client.post("/vendor/subscription", payload).then((r) => r.data),

  // ── Vendor advertisements ────────────────────────────────────────────
  getVendorAdvertisements: () =>
    client.get("/vendor/advertisements").then((r) => r.data),
  createVendorAdvertisement: (payload) =>
    client.post("/vendor/advertisements", payload).then((r) => r.data),
  updateVendorAdvertisementStatus: (id, status) =>
    client.patch(`/vendor/advertisements/${id}/status`, { status }).then((r) => r.data),

  // ── Buyer subscription (ad removal) ──────────────────────────────────
  getBuyerSubscription: () =>
    client.get("/buyer/subscription").then((r) => r.data),
  upgradeBuyerSubscription: (payload) =>
    client.post("/buyer/subscription", payload).then((r) => r.data),

  // ── Admin monetization ───────────────────────────────────────────────
  getAdminSubscriptions: (params) =>
    client.get("/admin/subscriptions", { params }).then((r) => r.data),
  updateAdminSubscriptionStatus: (id, status) =>
    client.patch(`/admin/subscriptions/${id}/status`, { status }).then((r) => r.data),
  getAdminBuyerSubscriptions: (params) =>
    client.get("/admin/buyer-subscriptions", { params }).then((r) => r.data),
  getAdminAdvertisements: (params) =>
    client.get("/admin/advertisements", { params }).then((r) => r.data),
  updateAdminAdvertisementStatus: (id, status) =>
    client.patch(`/admin/advertisements/${id}/status`, { status }).then((r) => r.data),
};
