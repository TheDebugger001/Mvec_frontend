import { useQuery } from "@tanstack/react-query";
import { affiliatesApi } from "../API";
import { queryKeys } from "../queryClient";

export const affiliateConversionsKey = [...queryKeys.affiliates, "conversions"];

export function normalizeConversion(c) {
  if (!c) return null;
  return {
    id: c.id || c._id,
    referralCode: c.referralCode || "",
    productId: c.productId || c.targetProduct || null,
    product: c.product || "Storewide link",
    orderId: c.order || null,
    conversionValue: Number(c.conversionValue) || 0,
    commissionEarned: Number(c.commissionEarned) || 0,
    status: c.status || "PENDING",
    convertedAt: c.convertedAt || c.createdAt || new Date().toISOString(),
  };
}

export function useAffiliateConversions(options = {}) {
  return useQuery({
    queryKey: affiliateConversionsKey,
    queryFn: async () => {
      try {
        const res = await affiliatesApi.getMyConversions();
        const raw = Array.isArray(res?.data) ? res.data : [];
        return raw.map(normalizeConversion).filter(Boolean);
      } catch {
        return [];
      }
    },
    enabled: !!localStorage.getItem("huska_token"),
    retry: false,
    ...options,
  });
}