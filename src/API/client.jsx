import axios from "axios";
const BASE_URL =
  import.meta.env.VITE_API_URL ||
  "https://kwegereza-backend-production.up.railway.app/api";
export const client = axios.create({ baseURL: BASE_URL });
client.interceptors.request.use((config) => {
  const token = localStorage.getItem("huska_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
export function extractErrorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    "Something went wrong. Please try again."
  );
}
