import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      refetchInterval: 1000 * 10,
      refetchOnWindowFocus: true,
      retry: 2,
    },
  },
});

export const queryKeys = {
  users: ["users"],
  products: ["products"],
  supplierProducts: ["supplierProducts"],
  suppliers: ["suppliers"],
  supplier: (id) => ["suppliers", id],
  orders: ["orders"],
  myOrders: ["orders", "mine"],
  vendorOrders: ["orders", "vendor"],
  payouts: ["payouts"],
  ledger: ["ledger"],
  reviews: ["reviews"],
  vendorReviews: ["reviews", "vendor"],
  abuseReports: ["abuseReports"],
  userSearch: (q) => ["users", "search", q],
  wallet: ["wallet"],
  affiliates: ["affiliates"],
};