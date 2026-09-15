import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ordersApi, wholesaleApi } from "../API";
import { queryKeys } from "../queryClient";

export function useMyOrders(options = {}) {
  return useQuery({
    queryKey: queryKeys.myOrders,
    queryFn: () => ordersApi.getMyOrders(),
    enabled: !!localStorage.getItem("huska_token"),
    ...options,
  });
}

export function useAllOrders(options = {}) {
  return useQuery({
    queryKey: queryKeys.orders,
    queryFn: () => ordersApi.getAllOrders(),
    enabled: !!localStorage.getItem("huska_token"),
    ...options,
  });
}

export function useVendorOrders(options = {}) {
  return useQuery({
    queryKey: queryKeys.vendorOrders,
    queryFn: () => ordersApi.getVendorOrders(),
    enabled: !!localStorage.getItem("huska_token"),
    ...options,
  });
}

export function useOrderById(id, options = {}) {
  return useQuery({
    queryKey: [...queryKeys.orders, id],
    queryFn: () => ordersApi.getById(id),
    enabled: !!id,
    ...options,
  });
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }) => ordersApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders });
    },
  });
}

export function useCreateWholesaleOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => wholesaleApi.createOrder(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.orders }),
  });
}

export function useHoldEscrow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderId) => wholesaleApi.holdEscrow(orderId, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.orders }),
  });
}

export function useConfirmWholesaleReceipt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, otp }) => wholesaleApi.confirmReceipt(orderId, otp),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.orders }),
  });
}