import { useQuery, useQueryClient } from "@tanstack/react-query";

/**
 * Query hook for localStorage-backed data that re-reads on every refetch
 * poll. Combined with the global refetchInterval this gives dashboards
 * near-real-time updates for local (demo/offline mode) state.
 */
export function useLocalQuery(queryKey, readFn, options = {}) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey,
    queryFn: () => {
      const value = readFn();
      return typeof value === "undefined" ? null : value;
    },
    staleTime: 1000 * 30,
    ...options,
  });

  return {
    ...query,
    invalidate: () => queryClient.invalidateQueries({ queryKey }),
  };
}