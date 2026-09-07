import { client, mapAuthResponse, mapUser } from "./client";

export const authApi = {
  register: (payload) => {
    const backendPayload = {
      Fullname: payload.fullName || payload.Fullname,
      email: payload.email,
      phone: payload.telephone || payload.phone,
      gender: payload.gender,
      role: payload.role,
      companyName: payload.companyName,
      password: payload.password,
    };
    return client
      .post("/auth/register", backendPayload)
      .then((r) => mapAuthResponse(r.data));
  },
  login: (identity, password) => {
    const isEmail = identity.includes("@");
    const backendPayload = isEmail
      ? { email: identity, password }
      : { phone: identity, password };
    return client
      .post("/auth/login", backendPayload)
      .then((r) => mapAuthResponse(r.data));
  },
  me: () =>
    client.get("/auth/me").then((r) => mapUser(r.data.user)),
  changePassword: (payload) =>
    client.post("/auth/change-password", payload).then((r) => r.data),
  forgotPassword: (payload) =>
    client.post("/auth/forgot-password", payload).then((r) => r.data),
  checkCode: (payload) =>
    client.post("/auth/check-code", payload).then((r) => r.data),
  resetPassword: (token, payload) =>
    client.post(`/auth/reset-password/${token}`, payload).then((r) => r.data),
};
