import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { payoutsApi, adminApi } from "../API";
import { queryKeys } from "../queryClient";

export function useWalletBalance(options = {}) {
  return useQuery({
    queryKey: [queryKeys.wallet[0], "balance"],
    queryFn: () => payoutsApi.getBalance(),
    enabled: !!localStorage.getItem("huska_token"),
    ...options,
  });
}

export function usePayoutHistory(options = {}) {
  return useQuery({
    queryKey: [queryKeys.payouts[0], "history"],
    queryFn: () => payoutsApi.getHistory(),
    enabled: !!localStorage.getItem("huska_token"),
    ...options,
  });
}

export function useRequestPayout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => payoutsApi.requestPayout(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.payouts });
      queryClient.invalidateQueries({ queryKey: queryKeys.wallet });
    },
  });
}

export function useAdminLedger(params, options = {}) {
  return useQuery({
    queryKey: [queryKeys.ledger[0], params],
    queryFn: () => adminApi.getLedger(params),
    enabled: !!localStorage.getItem("huska_token"),
    ...options,
  });
}

export function useAdminPayoutActions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ action, id }) =>
      action === "hold" ? adminApi.placeHold(id) : adminApi.releaseEscrow(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ledger });
      queryClient.invalidateQueries({ queryKey: queryKeys.payouts });
    },
  });
}