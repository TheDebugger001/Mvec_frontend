import { useQuery, useQueryClient } from "@tanstack/react-query";
import { suppliersApi } from "../API";
import { queryKeys } from "../queryClient";

export function useSuppliers(params, options = {}) {
  return useQuery({
    queryKey: [queryKeys.suppliers[0], params],
    queryFn: () => suppliersApi.getAll(params),
    ...options,
  });
}

export function useSupplierById(idOrSlug, options = {}) {
  return useQuery({
    queryKey: queryKeys.supplier(idOrSlug),
    queryFn: () => suppliersApi.getByIdOrSlug(idOrSlug),
    enabled: !!idOrSlug,
    ...options,
  });
}

export function useSupplierProducts(id, options = {}) {
  return useQuery({
    queryKey: [queryKeys.supplierProducts[0], id],
    queryFn: () => suppliersApi.getProducts(id),
    enabled: !!id,
    ...options,
  });
}

export function useRefreshSuppliers() {
  const queryClient = useQueryClient();
  return {
    refresh: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.suppliers });
      queryClient.invalidateQueries({ queryKey: queryKeys.supplierProducts });
    },
  };
}