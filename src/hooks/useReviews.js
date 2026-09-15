import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { reviewsApi } from "../API";
import { queryKeys } from "../queryClient";

export function useVendorReviews(options = {}) {
  return useQuery({
    queryKey: queryKeys.vendorReviews,
    queryFn: () => reviewsApi.getVendorReviews(),
    enabled: !!localStorage.getItem("huska_token"),
    ...options,
  });
}

export function useReviewReply() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reply }) => reviewsApi.reply(id, { reply }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vendorReviews });
      queryClient.invalidateQueries({ queryKey: queryKeys.reviews });
    },
  });
}