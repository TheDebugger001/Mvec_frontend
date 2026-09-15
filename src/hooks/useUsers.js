import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usersApi } from "../API";
import { queryKeys } from "../queryClient";

const titleCase = (s) =>
  String(s || "")
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

export const mapUserRow = (u) => ({
  id: u.id || u._id || `USR-${Date.now()}`,
  name: u.name || u.fullName || u.Fullname || u.username || "",
  email: u.email || "",
  role: titleCase(u.role || ""),
  status: titleCase(u.status || "Active"),
  phone: u.phone || "",
});

export function useUsers(params = { limit: 200 }, options = {}) {
  return useQuery({
    queryKey: [queryKeys.users[0], params],
    queryFn: () => usersApi.getAll(params),
    enabled: !!localStorage.getItem("huska_token"),
    ...options,
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => usersApi.update(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.users }),
  });
}