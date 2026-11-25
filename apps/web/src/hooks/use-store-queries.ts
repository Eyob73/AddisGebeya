"use client";

import { useQuery } from "@tanstack/react-query";
import { storeService, type ProductQueryFilters } from "@/services/store.service";

export function useProductsQuery(filters: ProductQueryFilters = {}) {
  return useQuery({
    queryKey: ["products", filters],
    queryFn: () => storeService.listProducts(filters),
  });
}

export function useProductDetailQuery(slug: string) {
  return useQuery({
    queryKey: ["product", slug],
    queryFn: () => storeService.getProductBySlug(slug),
    enabled: Boolean(slug),
  });
}

export function useCategoriesQuery() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: () => storeService.listCategories(),
  });
}

export function useOrdersQuery() {
  return useQuery({
    queryKey: ["orders"],
    queryFn: () => storeService.listOrders(),
  });
}

export function useAllReviewsQuery() {
  return useQuery({
    queryKey: ["all-reviews"],
    queryFn: () => storeService.listAllReviews(),
  });
}

export function useProductReviewsQuery(productId?: string) {
  return useQuery({
    queryKey: ["reviews", productId],
    queryFn: () => (productId ? storeService.listReviews(productId) : Promise.resolve([])),
    enabled: Boolean(productId),
  });
}

export function useAdminDashboardQuery() {
  return useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => storeService.getDashboard(),
  });
}

export function useAdminCustomersQuery() {
  return useQuery({
    queryKey: ["admin-customers"],
    queryFn: () => storeService.listCustomers(),
  });
}

export function useAdminInventoryQuery() {
  return useQuery({
    queryKey: ["admin-inventory"],
    queryFn: () => storeService.listInventory(),
  });
}

export function useStoreSettingsQuery() {
  return useQuery({
    queryKey: ["store-settings"],
    queryFn: () => storeService.getStoreSettings(),
  });
}

export function usePaymentSlipsQuery() {
  return useQuery({
    queryKey: ["payment-slips"],
    queryFn: () => storeService.listPaymentSlips(),
  });
}

export function useAddressesQuery(enabled = true) {
  return useQuery({
    queryKey: ["addresses"],
    queryFn: () => storeService.listAddresses(),
    enabled,
  });
}

export function useNotificationsQuery(enabled = true) {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => storeService.listNotifications(),
    enabled,
  });
}

export function usePaymentProvidersQuery() {
  return useQuery({
    queryKey: ["payment-providers"],
    queryFn: () => storeService.getPaymentProviders(),
    staleTime: 60 * 1000,
  });
}

export function usePaymentStatusQuery(orderId?: string) {
  return useQuery({
    queryKey: ["payment-status", orderId],
    queryFn: () => storeService.getPaymentStatus(orderId!),
    enabled: Boolean(orderId),
  });
}

export function useOrderReceiptsQuery(orderId?: string) {
  return useQuery({
    queryKey: ["payment-receipts", orderId],
    queryFn: () => storeService.getOrderReceipts(orderId!),
    enabled: Boolean(orderId),
  });
}

export function useAdminPaymentsQuery(filters: {
  status?: string;
  receiptStatus?: string;
  provider?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: ["admin-payments", filters],
    queryFn: () => storeService.listAdminPayments(filters),
  });
}

export function usePaymentProviderConfigsQuery() {
  return useQuery({
    queryKey: ["admin-payment-providers"],
    queryFn: () => storeService.listPaymentProviderConfigs(),
  });
}
