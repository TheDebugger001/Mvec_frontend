import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { productsApi, reportsApi } from "../API";
import { queryKeys } from "../queryClient";

export function useVendorProducts(options = {}) {
  return useQuery({
    queryKey: [queryKeys.products[0], "vendor"],
    queryFn: () => productsApi.getVendorProducts(),
    enabled: !!localStorage.getItem("huska_token"),
    ...options,
  });
}

export function useAllProducts(params, options = {}) {
  return useQuery({
    queryKey: [queryKeys.products[0], "all", params],
    queryFn: () => productsApi.getAll(params),
    enabled: !!localStorage.getItem("huska_token"),
    ...options,
  });
}

export function useProductById(id, options = {}) {
  return useQuery({
    queryKey: [...queryKeys.products, id],
    queryFn: () => productsApi.getById(id),
    enabled: !!id,
    ...options,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => productsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => productsApi.update(id, payload),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products });
      if (id) queryClient.invalidateQueries({ queryKey: [...queryKeys.products, id] });
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => productsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.products }),
  });
}

export function useAdminReports(params, options = {}) {
  return useQuery({
    queryKey: ["reports", params],
    queryFn: () => reportsApi.getSummary(params),
    enabled: !!localStorage.getItem("huska_token"),
    ...options,
  });
}