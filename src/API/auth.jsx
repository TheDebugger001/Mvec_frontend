import { client } from "./client";
export const authApi = {
  register: (payload) =>
    client.post("/auth/register", payload).then((r) => r.data.data),
  login: (payload) => client.post("/login", payload).then((r) => r.data.data),
  me: () => client.get("/auth/me").then((r) => r.data.data),
  changePassword: (payload) =>
    client.post("/auth/change-password", payload).then((r) => r.data.data),
  forgotPassword: (payload) =>
    client.post("/auth/forgot-password", payload).then((r) => r.data.data),
  checkCode: (payload) =>
    client.post("/auth/check-code", payload).then((r) => r.data.data),
};
