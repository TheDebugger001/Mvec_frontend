import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { suppliersApi } from "../API";

export const wholesaleQueryKey = ["supplierWholesaleProducts"];

const isAuth = () => !!localStorage.getItem("huska_token");

export function normalizeWholesaleProduct(p) {
  if (!p) return null;
  const media = p.media || {};
  const gallery = Array.isArray(media.gallery) ? media.gallery : [];
  const mainImage = media.mainImage || gallery[0] || "";
  return {
    id: p._id || p.id,
    name: p.name || "",
    category: p.category || "General",
    unit: p.unit || "piece",
    wholesalePrice: Number(p.wholesalePrice) || 0,
    retailPrice: Number(p.retailPrice) || 0,
    moq: Number(p.moq) || 1,
    stock: Number(p.stockQuantity ?? p.stock ?? 0),
    bulkDiscount: Number(p.bulkDiscount) || 0,
    status: p.status || "ACTIVE",
    images: [mainImage, ...gallery.filter((u) => u && u !== mainImage)],
    shortDescription: p.shortDescription || "",
    description: p.shortDescription || "",
    createdAt: p.createdAt,
    supplier: p.supplier,
  };
}

function readProducts(res) {
  const raw = Array.isArray(res?.products)
    ? res.products
    : Array.isArray(res?.data)
    ? res.data
    : Array.isArray(res)
    ? res
    : [];
  return raw.map(normalizeWholesaleProduct).filter(Boolean);
}

export function useMyWholesaleProducts(options = {}) {
  return useQuery({
    queryKey: wholesaleQueryKey,
    queryFn: async () => {
      try {
        const res = await suppliersApi.getMyProducts();
        return readProducts(res);
      } catch {
        return [];
      }
    },
    enabled: isAuth(),
    retry: false,
    ...options,
  });
}

export function buildWholesalePayload(form) {
  return {
    name: form.name,
    category: form.category || "General",
    unit: form.unit || "piece",
    shortDescription: form.description || form.shortDescription || "",
    wholesalePrice: Number(form.wholesalePrice) || 0,
    retailPrice: Number(form.retailPrice) || 0,
    moq: Math.max(1, Number(form.moq) || 1),
    stockQuantity: Math.max(0, Number(form.stock) || 0),
    bulkDiscount: Math.min(100, Math.max(0, Number(form.bulkDiscount) || 0)),
    media: {
      mainImage: form.images?.[0] || "",
      gallery: Array.isArray(form.images) ? form.images : [],
    },
  };
}

export function useCreateWholesaleProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => suppliersApi.createMyProduct(payload),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: wholesaleQueryKey });
      const previous = queryClient.getQueryData(wholesaleQueryKey) || [];
      const optimistic = normalizeWholesaleProduct({
        ...payload,
        _id: `NEW-${Date.now()}`,
        createdAt: new Date().toISOString(),
        status: "ACTIVE",
      });
      queryClient.setQueryData(wholesaleQueryKey, [optimistic, ...previous]);
      return { previous };
    },
    onError: (_err, _payload, context) => {
      if (context?.previous) queryClient.setQueryData(wholesaleQueryKey, context.previous);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: wholesaleQueryKey }),
  });
}

export function useUpdateWholesaleProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => suppliersApi.updateMyProduct(id, payload),
    onMutate: async ({ id, payload }) => {
      await queryClient.cancelQueries({ queryKey: wholesaleQueryKey });
      const previous = queryClient.getQueryData(wholesaleQueryKey) || [];
      const keys = Object.keys(payload || {});
      const statusOnly = keys.length === 1 && keys[0] === "status";
      queryClient.setQueryData(
        wholesaleQueryKey,
        previous.map((p) => {
          if (String(p.id) !== String(id)) return p;
          if (statusOnly) return { ...p, status: payload.status };
          return { ...p, ...normalizeWholesaleProduct({ ...payload, _id: id }), id: p.id };
        })
      );
      return { previous };
    },
    onError: (_err, _payload, context) => {
      if (context?.previous) queryClient.setQueryData(wholesaleQueryKey, context.previous);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: wholesaleQueryKey }),
  });
}

export function useDeleteWholesaleProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => suppliersApi.deleteMyProduct(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: wholesaleQueryKey });
      const previous = queryClient.getQueryData(wholesaleQueryKey) || [];
      queryClient.setQueryData(
        wholesaleQueryKey,
        previous.filter((p) => String(p.id) !== String(id))
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) queryClient.setQueryData(wholesaleQueryKey, context.previous);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: wholesaleQueryKey }),
  });
}