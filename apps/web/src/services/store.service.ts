import { apiClient } from "@/lib/api-client";
import { useCatalogStore } from "@/stores/catalog.store";
import type {
  AdminPaymentRecordDto,
  PaymentProviderConfigDto,
  PaymentProviderInfo,
  PaymentReceiptDto,
  PaymentStatusResponse,
  PaymentVerificationResponse,
  SubmitPaymentReceiptResponse,
} from "@addisgebeya/types";
import type {
  AddressRecord,
  CustomerRecord,
  NotificationRecord,
  OrderRecord,
  OrderStatus,
  PaymentSlipRecord,
  PaymentStatus,
  ProductImageItem,
  PromoCode,
  ShoeCategory,
  ShoeProduct,
  ShoeReview,
  StoreSettings,
} from "@/types/store.types";

export interface ProductQueryFilters {
  search?: string;
  categorySlug?: string;
  gender?: string;
  shoeType?: string;
  brand?: string;
  size?: number;
  colorHex?: string;
  minPrice?: number;
  maxPrice?: number;
  inStockOnly?: boolean;
  onSaleOnly?: boolean;
  status?: string;
  sortBy?: "featured" | "newest" | "best_selling" | "price_low" | "price_high" | "rating";
}

export interface CouponValidationResponse {
  ok: boolean;
  code: string;
  type: "fixed" | "percent";
  value: number;
  minSubtotalETB: number;
  description: string;
  discountETB: number;
}

export interface AdminDashboardData {
  metrics: {
    totalRevenueETB: number;
    totalOrders: number;
    activeCustomers: number;
    lowStockAlertsCount: number;
    averageOrderValueETB: number;
    categoriesCount: number;
    productsCount: number;
  };
  ordersBySubcity: Array<{ subCity: string; count: number; revenueETB: number }>;
  recentOrders: Array<{
    id: string;
    customerName: string;
    subCity: string;
    totalETB: number;
    status: string;
    paymentStatus: string;
    paymentMethod: string;
    itemCount: number;
    createdAt: string;
  }>;
}

export interface InventoryItemRecord {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  categoryName: string;
  colorwayId: string;
  colorwayName: string;
  colorHex: string;
  size: number;
  stockQuantity: number;
  lowStockThreshold: number;
  isLowStock: boolean;
  priceETB: number;
}

export const storeService = {
  async listProducts(filters: ProductQueryFilters = {}): Promise<ShoeProduct[]> {
    try {
      const data = await apiClient.get<ShoeProduct[]>("/products", {
        params: {
          search: filters.search,
          categorySlug: filters.categorySlug,
          gender: filters.gender,
          shoeType: filters.shoeType,
          brand: filters.brand,
          size: filters.size,
          colorHex: filters.colorHex,
          minPrice: filters.minPrice,
          maxPrice: filters.maxPrice,
          inStockOnly: filters.inStockOnly,
          onSaleOnly: filters.onSaleOnly,
          status: filters.status,
          sortBy: filters.sortBy,
        },
      });

      const localProducts = useCatalogStore.getState().products;
      if (localProducts.length > 0) {
        const remoteIds = new Set(data.map((p) => p.id));
        const extraLocal = localProducts.filter((p) => !remoteIds.has(p.id));
        return [...extraLocal, ...data];
      }
      return data;
    } catch {
      return useCatalogStore.getState().products;
    }
  },

  async getProductBySlug(slug: string): Promise<ShoeProduct | null> {
    try {
      const product = await apiClient.get<ShoeProduct>(`/products/${slug}`);
      return product;
    } catch {
      const local = useCatalogStore.getState().products.find((p) => p.slug === slug || p.id === slug);
      return local ?? null;
    }
  },

  async createProduct(payload: Partial<ShoeProduct>): Promise<ShoeProduct> {
    try {
      const created = await apiClient.post<ShoeProduct>("/products", payload);
      await useCatalogStore.getState().addProduct(created);
      return created;
    } catch (err: unknown) {
      const isNetworkError =
        err instanceof TypeError ||
        (err instanceof Error &&
          (err.message.includes("fetch") || err.message.includes("Network") || err.message.includes("Failed to fetch")));
      if (isNetworkError) {
        const fallback: ShoeProduct = {
          id: payload.id || `prod-${Date.now()}`,
          slug: payload.slug || `shoe-${Date.now()}`,
          sku: payload.sku || `AG-SKU-${Math.floor(1000 + Math.random() * 9000)}`,
          name: payload.name || "Untitled Shoe",
          brand: payload.brand || "Addis Performance Lab",
          categorySlug: payload.categorySlug || "running",
          categoryName: payload.categoryName || "Running & Performance",
          gender: payload.gender || "Unisex",
          tagline: payload.tagline || "",
          description: payload.description || "",
          priceETB: payload.priceETB || 0,
          compareAtPriceETB: payload.compareAtPriceETB,
          cogsETB: payload.cogsETB,
          rating: payload.rating || 5.0,
          reviewCount: payload.reviewCount || 1,
          badges: payload.badges || ["New Release"],
          status: payload.status || "active",
          featuredTrending: payload.featuredTrending ?? true,
          featuredNewDrop: payload.featuredNewDrop ?? true,
          isOnSale: payload.isOnSale ?? false,
          freeAddisDelivery: payload.freeAddisDelivery ?? true,
          reserveShowroomPairs: payload.reserveShowroomPairs ?? true,
          dispatchDepot: payload.dispatchDepot || "Bole Medhanialem Flagship Hub (Primary)",
          colorways: payload.colorways || [],
          specs: payload.specs || {
            upperMesh: "Jacquard Air-Flow",
            cushioning: "NitroPro Supercritical Foam",
            outsoleGrip: "Entoto Multi-Terrain Rubber Grip",
            weightGrams: 265,
            heelDropMm: 8,
            fitAdvice: "Fits true to size.",
            materials: ["Ethiopian Leather"],
          },
          createdAt: new Date().toISOString(),
        };
        await useCatalogStore.getState().addProduct(fallback);
        return fallback;
      }
      throw err;
    }
  },

  async updateProduct(id: string, patch: Partial<ShoeProduct>): Promise<ShoeProduct> {
    try {
      const updated = await apiClient.patch<ShoeProduct>(`/products/${id}`, patch);
      await useCatalogStore.getState().updateProduct(id, patch);
      return updated;
    } catch (err: unknown) {
      await useCatalogStore.getState().updateProduct(id, patch);
      const found = useCatalogStore.getState().products.find((p) => p.id === id);
      if (found) return found;
      throw err;
    }
  },

  async deleteProduct(id: string): Promise<void> {
    try {
      await apiClient.delete(`/products/${id}`);
    } catch {
      // Continue to remove locally if network fails
    }
    await useCatalogStore.getState().deleteProduct(id);
  },

  async getProductImages(productId: string): Promise<ProductImageItem[]> {
    return await apiClient.get<ProductImageItem[]>(`/products/${productId}/images`);
  },

  async uploadProductImages(productId: string, formData: FormData): Promise<ProductImageItem[]> {
    return await apiClient.post<ProductImageItem[]>(`/products/${productId}/images`, formData);
  },

  async replaceProductImage(productId: string, imageId: string, formData: FormData): Promise<ProductImageItem> {
    return await apiClient.put<ProductImageItem>(`/products/${productId}/images/${imageId}`, formData);
  },

  async deleteProductImage(productId: string, imageId: string): Promise<void> {
    await apiClient.delete(`/products/${productId}/images/${imageId}`);
  },

  async setPrimaryProductImage(productId: string, imageId: string): Promise<ProductImageItem> {
    return await apiClient.patch<ProductImageItem>(`/products/${productId}/images/${imageId}/primary`);
  },

  async assignProductImageColorway(
    productId: string,
    imageId: string,
    colorwayId: string | null,
  ): Promise<ProductImageItem> {
    return await apiClient.patch<ProductImageItem>(`/products/${productId}/images/${imageId}/colorway`, {
      colorwayId,
    });
  },

  async reorderProductImages(
    productId: string,
    imageOrders: Array<{ id: string; displayOrder: number }>,
  ): Promise<ProductImageItem[]> {
    return await apiClient.put<ProductImageItem[]>(`/products/${productId}/images/reorder`, {
      imageOrders,
    });
  },

  async listCategories(): Promise<ShoeCategory[]> {
    return apiClient.get<ShoeCategory[]>("/categories");
  },

  async createCategory(payload: Partial<ShoeCategory>): Promise<ShoeCategory> {
    const created = await apiClient.post<ShoeCategory>("/categories", payload);
    useCatalogStore.getState().addCategory(created);
    return created;
  },

  async updateCategory(id: string, patch: Partial<ShoeCategory>): Promise<ShoeCategory> {
    const updated = await apiClient.patch<ShoeCategory>(`/categories/${id}`, patch);
    useCatalogStore.getState().updateCategory(id, patch);
    return updated;
  },

  async deleteCategory(id: string): Promise<void> {
    await apiClient.delete(`/categories/${id}`);
    useCatalogStore.getState().deleteCategory(id);
  },

  async getCategoryBySlug(slug: string): Promise<ShoeCategory | null> {
    try {
      const category = await apiClient.get<ShoeCategory>(`/categories/${slug}`);
      return category;
    } catch {
      return null;
    }
  },

  async listOrders(): Promise<OrderRecord[]> {
    return apiClient.get<OrderRecord[]>("/orders");
  },

  async getOrderById(id: string): Promise<OrderRecord | null> {
    try {
      const normalized = id.replace(/^#/, "").trim();
      return await apiClient.get<OrderRecord>(`/orders/${normalized}`);
    } catch {
      return null;
    }
  },

  async createOrder(payload: Partial<OrderRecord>): Promise<OrderRecord> {
    const order = await apiClient.post<OrderRecord>("/orders", payload);
    useCatalogStore.getState().syncFromBackend().catch(() => {});
    return order;
  },

  async updateOrderStatus(
    orderId: string,
    status: OrderStatus,
    courierName?: string,
  ): Promise<OrderRecord> {
    const updated = await apiClient.patch<OrderRecord>(`/orders/${orderId}/status`, {
      status,
      courierName,
    });
    useCatalogStore.getState().updateOrderStatus(orderId, status, courierName);
    return updated;
  },

  async verifyOrderPayment(
    orderId: string,
    reference: string,
    paymentStatus?: PaymentStatus,
  ): Promise<OrderRecord> {
    const updated = await apiClient.patch<OrderRecord>(`/orders/${orderId}/verify-payment`, {
      reference,
      paymentStatus,
    });
    useCatalogStore.getState().verifyOrderPayment(orderId, reference, paymentStatus);
    return updated;
  },

  async updateSizeStock(
    productId: string,
    colorwayId: string,
    size: number,
    quantity: number,
  ): Promise<void> {
    await apiClient.patch(`/products/${productId}/stock`, {
      colorwayId,
      size,
      quantity,
    });
    useCatalogStore.getState().updateSizeStock(productId, colorwayId, size, quantity);
  },

  async bulkRestockProduct(
    productId: string,
    colorwayId: string,
    stockBySize: Record<number, number>,
  ): Promise<void> {
    await apiClient.post(`/products/${productId}/restock`, {
      colorwayId,
      stockBySize,
    });
    useCatalogStore.getState().bulkRestockProduct(productId, colorwayId, stockBySize);
  },

  async attachSlipToOrder(slipId: string, orderId: string): Promise<void> {
    await apiClient.post("/payments/slips/attach", {
      slipId,
      orderId,
    });
    useCatalogStore.getState().attachSlipToOrder(slipId, orderId);
  },

  async getStoreSettings(): Promise<StoreSettings> {
    return apiClient.get<StoreSettings>("/settings");
  },

  async updateStoreSettings(patch: Partial<StoreSettings>): Promise<StoreSettings> {
    const updated = await apiClient.patch<StoreSettings>("/settings", patch);
    useCatalogStore.setState((state) => ({
      settings: { ...state.settings, ...updated },
    }));
    return updated;
  },

  async uploadHeroImage(file: File): Promise<{ url: string }> {
    const formData = new FormData();
    formData.append("image", file);
    return apiClient.post<{ url: string }>("/settings/hero-image", formData);
  },

  async validateCoupon(
    code: string,
    subtotalETB: number,
  ): Promise<{ ok: boolean; message: string; promo?: PromoCode }> {
    try {
      const result = await apiClient.post<CouponValidationResponse>("/coupons/validate", {
        code,
        subtotalETB,
      });
      return {
        ok: true,
        message: `Promo code ${result.code} applied successfully!`,
        promo: {
          code: result.code,
          type: result.type,
          value: result.value,
          minSubtotalETB: result.minSubtotalETB,
          description: result.description,
        },
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Invalid promo code";
      return {
        ok: false,
        message: errorMsg,
      };
    }
  },

  async listAllReviews(): Promise<ShoeReview[]> {
    try {
      return await apiClient.get<ShoeReview[]>("/reviews");
    } catch {
      return [];
    }
  },

  async listReviews(productId: string): Promise<ShoeReview[]> {
    try {
      return await apiClient.get<ShoeReview[]>(`/reviews/product/${productId}`);
    } catch {
      return [];
    }
  },

  async addReview(review: Partial<ShoeReview>): Promise<ShoeReview> {
    const created = await apiClient.post<ShoeReview>("/reviews", review);
    return created;
  },

  async markHelpful(reviewId: string): Promise<void> {
    await apiClient.post(`/reviews/${reviewId}/helpful`);
  },

  async getDashboard(): Promise<AdminDashboardData> {
    return apiClient.get<AdminDashboardData>("/admin/dashboard");
  },

  async listCustomers(): Promise<CustomerRecord[]> {
    return apiClient.get<CustomerRecord[]>("/admin/customers");
  },

  async listInventory(): Promise<InventoryItemRecord[]> {
    return apiClient.get<InventoryItemRecord[]>("/admin/inventory");
  },

  async listPaymentSlips(): Promise<PaymentSlipRecord[]> {
    return apiClient.get<PaymentSlipRecord[]>("/payments/slips");
  },

  async listAddresses(): Promise<AddressRecord[]> {
    try {
      return await apiClient.get<AddressRecord[]>("/addresses");
    } catch {
      return [];
    }
  },

  async getAddressById(id: string): Promise<AddressRecord> {
    return apiClient.get<AddressRecord>(`/addresses/${id}`);
  },

  async createAddress(payload: Partial<AddressRecord>): Promise<AddressRecord> {
    return apiClient.post<AddressRecord>("/addresses", payload);
  },

  async updateAddress(id: string, patch: Partial<AddressRecord>): Promise<AddressRecord> {
    return apiClient.patch<AddressRecord>(`/addresses/${id}`, patch);
  },

  async deleteAddress(id: string): Promise<void> {
    await apiClient.delete(`/addresses/${id}`);
  },

  async setDefaultAddress(id: string): Promise<AddressRecord> {
    return apiClient.patch<AddressRecord>(`/addresses/${id}/default`, {});
  },

  async uploadAvatar(avatarInput: string | File): Promise<{ id: string; avatarUrl?: string; message: string }> {
    const payload =
      typeof File !== "undefined" && avatarInput instanceof File
        ? (() => {
            const fd = new FormData();
            fd.append("avatar", avatarInput);
            return fd;
          })()
        : { avatarUrl: avatarInput };
    return apiClient.post("/auth/avatar", payload);
  },

  async logoutAll(): Promise<{ success: boolean; message: string }> {
    return apiClient.post("/auth/logout-all");
  },

  async deactivateAccount(passwordConfirm: string): Promise<{ deactivated: boolean; message: string }> {
    return apiClient.post("/auth/deactivate", { passwordConfirm });
  },

  async listNotifications(): Promise<NotificationRecord[]> {
    try {
      return await apiClient.get<NotificationRecord[]>("/notifications");
    } catch {
      return [];
    }
  },

  async markNotificationRead(id: string): Promise<NotificationRecord> {
    return apiClient.patch<NotificationRecord>(`/notifications/${id}/read`, {});
  },

  async markAllNotificationsRead(): Promise<void> {
    await apiClient.patch("/notifications/read-all", {});
  },

  async broadcastNotification(payload: { title: string; message: string }): Promise<void> {
    await apiClient.post("/notifications/admin/broadcast", payload);
  },

  async initializePayment(payload: {
    orderIdOrNumber: string;
    paymentMethod: "telebirr" | "cbeBirr" | "chapa" | "cod" | "bank_transfer";
    phone?: string;
    returnUrl?: string;
  }): Promise<{
    transactionReference: string;
    paymentMethod: string;
    status: string;
    amountETB: number;
    checkoutUrl?: string;
    instructions: string;
    isSandbox: boolean;
  }> {
    return apiClient.post("/payments/initialize", payload);
  },

  async getPaymentProviders(): Promise<PaymentProviderInfo[]> {
    const res = await apiClient.get<{ providers: PaymentProviderInfo[] }>("/payment/providers");
    return res.providers ?? [];
  },

  async verifyPayment(payload: {
    orderId: string;
    provider: string;
    reference?: string;
    accountNumber?: string;
    qrData?: string;
    phoneNumber?: string;
  }): Promise<PaymentVerificationResponse> {
    return apiClient.post<PaymentVerificationResponse>("/payment/verify", payload);
  },

  async getPaymentStatus(orderId: string): Promise<PaymentStatusResponse> {
    return apiClient.get<PaymentStatusResponse>(`/payment/status/${encodeURIComponent(orderId)}`);
  },

  async extractReceiptOcr(formData: FormData): Promise<import("@/types/store.types").ReceiptOcrExtractionDto> {
    return apiClient.post<import("@/types/store.types").ReceiptOcrExtractionDto>(
      "/payment/receipts/extract",
      formData,
    );
  },

  async submitPaymentReceipt(formData: FormData): Promise<SubmitPaymentReceiptResponse> {
    return apiClient.post<SubmitPaymentReceiptResponse>("/payment/receipts", formData);
  },

  async verifyPaymentReceipt(
    receiptId: string,
    payload: {
      provider?: string;
      transactionReference?: string;
      qrData?: string;
      cbeReceiptToken?: string;
      officialReceiptUrl?: string;
      accountNumber?: string;
      phoneNumber?: string;
    },
  ): Promise<SubmitPaymentReceiptResponse> {
    return apiClient.post<SubmitPaymentReceiptResponse>(
      `/payment/receipts/${encodeURIComponent(receiptId)}/verify`,
      payload,
    );
  },

  async getOrderReceipts(orderId: string): Promise<PaymentReceiptDto[]> {
    const res = await apiClient.get<{ receipts: PaymentReceiptDto[] }>(
      `/payment/receipts/order/${encodeURIComponent(orderId)}`,
    );
    return res.receipts ?? [];
  },

  async getReceiptAccessUrl(
    receiptId: string,
  ): Promise<import("@/types/store.types").ReceiptAccessUrlResponse> {
    return apiClient.post<import("@/types/store.types").ReceiptAccessUrlResponse>(
      `/payment/receipts/${encodeURIComponent(receiptId)}/access`,
      {},
    );
  },

  async listAdminPayments(params?: {
    status?: string;
    receiptStatus?: string;
    provider?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    items: AdminPaymentRecordDto[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
    summary: {
      paidCount: number;
      pendingCount: number;
      reviewRequiredCount: number;
      failedCount: number;
      pendingReceiptsCount?: number;
      manualReviewCount?: number;
      verifiedReceiptsCount?: number;
    };
  }> {
    return apiClient.get("/admin/payments", { params });
  },

  async reviewAdminPayment(
    paymentId: string,
    payload: {
      decision: "approve" | "reject" | "request_new_receipt";
      reason: string;
      reference?: string;
      cbeReceiptToken?: string;
      officialReceiptUrl?: string;
      requestNewReceipt?: boolean;
    },
  ): Promise<AdminPaymentRecordDto> {
    return apiClient.post<AdminPaymentRecordDto>(`/admin/payments/${paymentId}/review`, payload);
  },

  async listPaymentProviderConfigs(): Promise<PaymentProviderConfigDto[]> {
    return apiClient.get<PaymentProviderConfigDto[]>("/admin/payment-providers");
  },

  async updatePaymentProviderConfig(
    providerCode: string,
    patch: {
      displayName?: string;
      receivingAccountName: string;
      receivingAccountNumber: string;
      accountSuffixDigits?: number | null;
      instructions?: string | null;
      isEnabled?: boolean;
      maxPaymentAgeDays?: number;
    },
  ): Promise<PaymentProviderConfigDto> {
    return apiClient.put<PaymentProviderConfigDto>(`/admin/payment-providers/${providerCode}`, patch);
  },
};
