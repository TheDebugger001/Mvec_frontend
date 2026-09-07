import { client } from "./client";

export const adminApi = {
  getLedger: (params) =>
    client.get("/admin/ledger", { params }).then((r) => r.data),
  placeHold: (settlementId) =>
    client.patch(`/admin/settlements/${settlementId}/hold`).then((r) => r.data),
  releaseEscrow: (settlementId) =>
    client.post(`/admin/settlements/${settlementId}/release`).then((r) => r.data),
  createCommissionRule: (payload) =>
    client.post("/admin/commissions", payload).then((r) => r.data),
  getCommissionRules: () =>
    client.get("/admin/commissions").then((r) => r.data),
  toggleCommissionRule: (id) =>
    client.patch(`/admin/commissions/${id}/toggle`).then((r) => r.data),
  getTranslations: () =>
    client.get("/admin/translations").then((r) => r.data),
  upsertTranslation: (payload) =>
    client.post("/admin/translations", payload).then((r) => r.data),
  getVendors: (params) =>
    client.get("/admin/vendors", { params }).then((r) => r.data),
  verifyVendor: (id) =>
    client.patch(`/admin/vendors/${id}/verify`).then((r) => r.data),
  updateVendorStatus: (id, payload) =>
    client.patch(`/admin/vendors/${id}/status`, payload).then((r) => r.data),
  getSuppliers: (params) =>
    client.get("/admin/suppliers", { params }).then((r) => r.data),
  verifySupplier: (id) =>
    client.patch(`/admin/suppliers/${id}/verify`).then((r) => r.data),
  updateSupplierStatus: (id, payload) =>
    client.patch(`/admin/suppliers/${id}/status`, payload).then((r) => r.data),
};
