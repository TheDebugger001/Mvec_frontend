import axios from "axios";

const BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:4000/api";

export const client = axios.create({ baseURL: BASE_URL });

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("huska_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("huska_token");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export function extractErrorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    "Something went wrong. Please try again."
  );
}

export function mapUser(u) {
  if (!u) return null;
  return {
    id: u._id || u.id,
    fullName: u.Fullname || u.fullName || u.name || "",
    telephone: u.phone || u.telephone || "",
    email: u.email || "",
    gender: u.gender || "other",
    role: u.role || "buyer",
    companyName: u.companyName || "",
  };
}

export function mapAuthResponse(data) {
  return {
    token: data.token,
    user: mapUser(data.user),
  };
}
