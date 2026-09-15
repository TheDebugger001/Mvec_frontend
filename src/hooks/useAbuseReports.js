import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { abuseReportsApi, usersApi } from "../API";
import { queryKeys } from "../queryClient";

export function useAbuseReports(params = {}, options = {}) {
  return useQuery({
    queryKey: [queryKeys.abuseReports[0], params],
    queryFn: () => abuseReportsApi.getMine(params),
    enabled: !!localStorage.getItem("huska_token"),
    ...options,
  });
}

export function useSubmitAbuseReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => abuseReportsApi.submit(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.abuseReports });
    },
  });
}

export function useUpdateAbuseReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => abuseReportsApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.abuseReports });
    },
  });
}

export function useUserSearch(q, options = {}) {
  const trimmed = String(q || "").trim();
  return useQuery({
    queryKey: queryKeys.userSearch(trimmed),
    queryFn: () => usersApi.search(trimmed),
    enabled: !!localStorage.getItem("huska_token") && trimmed.length >= 2,
    staleTime: 1000 * 60,
    ...options,
  });
}