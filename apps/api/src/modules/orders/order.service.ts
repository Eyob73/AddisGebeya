import { HTTP_STATUS, resolveOfficialReceiptLink } from "@addisgebeya/shared";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database.js";
import { AppError } from "../../utils/app-error.js";
import { notificationService } from "../notifications/notification.service.js";

export interface CreateOrderPayload {
  customerId?: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  city?: string;
  subCity: string;
  landmark?: string;
  riderNotes?: string;
  deliverySpeed?: "standard" | "vip";
  paymentMethod: string;
  paymentReference?: string;
  promoCode?: string;
  items: Array<{
    productId: string;
    productName: string;
    sku?: string;
    colorwayId?: string;
    colorwayName: string;
    size: number;
    quantity: number;
    unitPriceETB?: number;
    image: string;
  }>;
}

function mapProviderCodeFromMethod(method: string): string {
  const m = (method || "cbe").trim().toLowerCase();
  if (m === "cbe_birr" || m === "cbebirr") return "cbebirr";
  if (m === "bank_transfer") return "cbe";
  return m;
}

function appendOrderTrackingEvent(
  existingEvents: unknown,
  step: string,
  description: string,
): Prisma.InputJsonValue {
  const baseEvents = Array.isArray(existingEvents) ? [...existingEvents] : [];
  const cleared = baseEvents.map((ev) =>
    ev && typeof ev === "object" ? { ...(ev as Record<string, unknown>), current: false } : ev,
  );
  return [
    ...cleared,
    {
      step,
      description,
      timestamp: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      completed: true,
      current: true,
    },
  ] as Prisma.InputJsonValue;
}

function mapOrderStatusNotification(
  status: string,
  orderNumber: string,
  courierName?: string | null,
): {
  type: string;
  title: string;
  message: string;
  trackingStep: string;
  trackingDescription: string;
} | null {
  const norm = status.trim().toLowerCase();
  const courierSuffix = courierName ? ` Courier: ${courierName}.` : "";

  if (norm === "confirmed") {
    return {
      type: "order_confirmed",
      title: `Order Confirmed — #${orderNumber}`,
      message: `Your order #${orderNumber} has been confirmed and queued for preparation at our Bole hub.`,
      trackingStep: "Order Confirmed",
      trackingDescription: "Order confirmed and queued for fulfillment.",
    };
  }
  if (norm === "processing" || norm === "packed") {
    return {
      type: "order_processing",
      title: `Order Processing Started — #${orderNumber}`,
      message: `Your order #${orderNumber} is now being packed and quality-checked for dispatch.`,
      trackingStep: "Order Processing",
      trackingDescription: "Footwear inspection and packaging started at Bole hub.",
    };
  }
  if (norm === "shipped" || norm === "shipped_regional") {
    return {
      type: "order_shipped",
      title: `Order Dispatched — #${orderNumber}`,
      message: `Great news! Your order #${orderNumber} has been shipped and is on the way.${courierSuffix}`,
      trackingStep: norm === "shipped_regional" ? "Shipped Regional" : "Order Dispatched",
      trackingDescription: `Dispatched from AddisGebeya hub.${courierSuffix}`,
    };
  }
  if (norm === "out_for_delivery" || norm === "outfordelivery") {
    return {
      type: "order_out_for_delivery",
      title: `Out for Delivery — #${orderNumber}`,
      message: `Your order #${orderNumber} is out for delivery in Addis Ababa.${courierSuffix} Please keep your phone nearby.`,
      trackingStep: "Out for Delivery",
      trackingDescription: `Rider en route to delivery address.${courierSuffix}`,
    };
  }
  if (norm === "delivered") {
    return {
      type: "order_delivered",
      title: `Order Delivered — #${orderNumber}`,
      message: `Your order #${orderNumber} has been delivered. Thank you for shopping with AddisGebeya!`,
      trackingStep: "Delivered",
      trackingDescription: "Order delivered to recipient.",
    };
  }
  if (norm === "cancelled") {
    return {
      type: "order_cancelled",
      title: `Order Cancelled — #${orderNumber}`,
      message: `Your order #${orderNumber} has been cancelled. If you already paid, please contact support for refund assistance.`,
      trackingStep: "Order Cancelled",
      trackingDescription: "Order was cancelled and stock released.",
    };
  }
  return null;
}

export class OrderService {
  private mapOrder(order: {
    id: string;
    orderNumber: string;
    userId: string | null;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    city: string;
    subCity: string;
    landmark: string | null;
    riderNotes: string | null;
    deliverySpeed: string;
    deliveryFeeETB: unknown;
    subtotalETB: unknown;
    discountETB: unknown;
    promoCode: string | null;
    totalETB: unknown;
    paymentMethod: string;
    paymentStatus: string;
    paymentReference: string | null;
    status: string;
    courierName: string | null;
    waybill: string | null;
    trackingEvents: unknown;
    createdAt: Date;
    payment?: {
      provider: string;
      transactionReference: string;
      verifiedReference: string | null;
      officialReceiptUrl: string | null;
      cbeReceiptToken: string | null;
      sourceUrl: string | null;
    } | null;
    receipts?: Array<{
      id: string;
      provider: string;
      status: string;
      verificationSource: string;
      rejectionReason: string | null;
      failureReason: string | null;
      resubmissionRequested: boolean;
      transactionReference: string | null;
      extractedReference: string | null;
      extractedQrData: string | null;
      officialReceiptUrl: string | null;
      cbeReceiptToken: string | null;
    }>;
    items: Array<{
      productId: string | null;
      productName: string;
      sku: string;
      colorwayName: string;
      size: number;
      quantity: number;
      unitPriceETB: unknown;
      image: string;
    }>;
  }) {
    const defaultTracking = [
      {
        step: "Order Confirmed",
        description: `Order received and registered with ${order.paymentMethod.toUpperCase()}.`,
        timestamp: new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        completed: true,
      },
    ];

    const trackingEvents = Array.isArray(order.trackingEvents) && order.trackingEvents.length > 0
      ? order.trackingEvents
      : defaultTracking;

    const latestReceipt = order.receipts?.[0];
    const officialLink = resolveOfficialReceiptLink({
      provider: order.payment?.provider || order.paymentMethod || latestReceipt?.provider || "",
      transactionReference:
        order.payment?.transactionReference ?? order.paymentReference ?? latestReceipt?.transactionReference,
      verifiedReference: order.payment?.verifiedReference ?? null,
      extractedReference: latestReceipt?.extractedReference ?? null,
      officialReceiptUrl:
        order.payment?.officialReceiptUrl ?? latestReceipt?.officialReceiptUrl ?? null,
      sourceUrl: order.payment?.sourceUrl ?? null,
      cbeReceiptToken:
        order.payment?.cbeReceiptToken ?? latestReceipt?.cbeReceiptToken ?? null,
      qrData: latestReceipt?.extractedQrData ?? null,
    });

    return {
      id: order.orderNumber ?? order.id,
      dbId: order.id,
      customerId: order.userId ?? "guest",
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerEmail: order.customerEmail,
      city: order.city,
      subCity: order.subCity,
      landmark: order.landmark ?? "",
      riderNotes: order.riderNotes ?? undefined,
      deliverySpeed: (order.deliverySpeed as "standard" | "vip") || "standard",
      deliveryFeeETB: Number(order.deliveryFeeETB),
      subtotalETB: Number(order.subtotalETB),
      discountETB: Number(order.discountETB),
      promoCode: order.promoCode ?? undefined,
      totalETB: Number(order.totalETB),
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      paymentReference: order.paymentReference ?? undefined,
      receiptStatus:
        (latestReceipt?.status as
          | "Pending"
          | "Processing"
          | "Verified"
          | "Rejected"
          | "Manual Review"
          | "Approved") ?? null,
      verificationSource: latestReceipt?.verificationSource ?? null,
      latestReceiptId: latestReceipt?.id ?? null,
      officialReceiptUrl: officialLink.officialReceiptUrl,
      cbeReceiptToken: officialLink.cbeReceiptToken,
      officialReceiptReason: officialLink.reason ?? null,
      latestReceiptRejectionReason:
        latestReceipt?.rejectionReason ?? latestReceipt?.failureReason ?? null,
      latestReceiptResubmissionRequested: latestReceipt?.resubmissionRequested ?? false,
      status: order.status,
      courierName: order.courierName ?? undefined,
      waybill: order.waybill ?? undefined,
      items: order.items.map((item) => ({
        productId: item.productId ?? "",
        productName: item.productName,
        sku: item.sku,
        colorwayName: item.colorwayName,
        size: item.size,
        quantity: item.quantity,
        unitPriceETB: Number(item.unitPriceETB),
        image: item.image,
      })),
      trackingEvents,
      createdAt: new Date(order.createdAt).toISOString(),
    };
  }

  async listOrders(userId?: string, isAdmin = false) {
    const orders = await prisma.order.findMany({
      where: isAdmin && !userId ? {} : userId ? { userId } : {},
      include: {
        items: true,
        payment: {
          select: {
            provider: true,
            transactionReference: true,
            verifiedReference: true,
            officialReceiptUrl: true,
            cbeReceiptToken: true,
            sourceUrl: true,
          },
        },
        receipts: {
          orderBy: { submittedAt: "desc" },
          take: 1,
          select: {
            id: true,
            provider: true,
            status: true,
            verificationSource: true,
            rejectionReason: true,
            failureReason: true,
            resubmissionRequested: true,
            transactionReference: true,
            extractedReference: true,
            extractedQrData: true,
            officialReceiptUrl: true,
            cbeReceiptToken: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return orders.map(this.mapOrder);
  }

  async getOrderById(idOrNumber: string) {
    const normalized = idOrNumber.replace(/^#/, "").trim();
    const order = await prisma.order.findFirst({
      where: {
        OR: [{ id: normalized }, { orderNumber: normalized }, { orderNumber: `AG-${normalized}` }],
      },
      include: {
        items: true,
        payment: {
          select: {
            provider: true,
            transactionReference: true,
            verifiedReference: true,
            officialReceiptUrl: true,
            cbeReceiptToken: true,
            sourceUrl: true,
          },
        },
        receipts: {
          orderBy: { submittedAt: "desc" },
          take: 1,
          select: {
            id: true,
            provider: true,
            status: true,
            verificationSource: true,
            rejectionReason: true,
            failureReason: true,
            resubmissionRequested: true,
            transactionReference: true,
            extractedReference: true,
            extractedQrData: true,
            officialReceiptUrl: true,
            cbeReceiptToken: true,
          },
        },
      },
    });

    if (!order) {
      throw new AppError({
        message: `Order #${idOrNumber} not found`,
        statusCode: HTTP_STATUS.NOT_FOUND,
        code: "ORDER_NOT_FOUND",
      });
    }

    return this.mapOrder(order);
  }

  async getOrderByIdForActor(
    idOrNumber: string,
    actor: {
      userId?: string | null;
      userEmail?: string | null;
      guestSessionId?: string | null;
      role?: string | null;
    },
  ) {
    const normalized = idOrNumber.replace(/^#/, "").trim();
    const order = await prisma.order.findFirst({
      where: {
        OR: [{ id: normalized }, { orderNumber: normalized }, { orderNumber: `AG-${normalized}` }],
      },
      include: {
        items: true,
        payment: {
          select: {
            provider: true,
            transactionReference: true,
            verifiedReference: true,
            officialReceiptUrl: true,
            cbeReceiptToken: true,
            sourceUrl: true,
          },
        },
        receipts: {
          orderBy: { submittedAt: "desc" },
          take: 1,
          select: {
            id: true,
            provider: true,
            status: true,
            verificationSource: true,
            rejectionReason: true,
            failureReason: true,
            resubmissionRequested: true,
            transactionReference: true,
            extractedReference: true,
            extractedQrData: true,
            officialReceiptUrl: true,
            cbeReceiptToken: true,
          },
        },
      },
    });

    if (!order) {
      throw new AppError({
        message: `Order #${idOrNumber} not found`,
        statusCode: HTTP_STATUS.NOT_FOUND,
        code: "ORDER_NOT_FOUND",
      });
    }

    if (actor.role !== "ADMIN") {
      if (!actor.userId && !actor.guestSessionId) {
        throw new AppError({
          message: "Authentication required to view order details",
          statusCode: HTTP_STATUS.UNAUTHORIZED,
          code: "UNAUTHORIZED",
        });
      }

      if (actor.userId) {
        const isOwner =
          order.userId === actor.userId ||
          (Boolean(actor.userEmail) &&
            order.customerEmail.toLowerCase() === actor.userEmail!.toLowerCase());
        if (!isOwner) {
          throw new AppError({
            message: "You do not have permission to access this order",
            statusCode: HTTP_STATUS.FORBIDDEN,
            code: "FORBIDDEN",
          });
        }
      } else if (actor.guestSessionId) {
        const isGuestOwner =
          !order.userId &&
          Boolean(order.guestSessionId) &&
          order.guestSessionId === actor.guestSessionId;
        if (!isGuestOwner) {
          throw new AppError({
            message: "You do not have permission to access this order",
            statusCode: HTTP_STATUS.FORBIDDEN,
            code: "FORBIDDEN",
          });
        }
      }
    }

    return this.mapOrder(order);
  }

  async trackGuestOrder(orderNumberInput: string, emailInput: string) {
    const rawOrderNumber = orderNumberInput.replace(/^#/, "").trim();
    const withoutPrefix = rawOrderNumber.replace(/^AG-/i, "");
    const normalizedEmail = emailInput.trim().toLowerCase();

    const order = await prisma.order.findFirst({
      where: {
        customerEmail: {
          equals: normalizedEmail,
          mode: "insensitive",
        },
        OR: [
          { orderNumber: { equals: rawOrderNumber, mode: "insensitive" } },
          { orderNumber: { equals: `AG-${withoutPrefix}`, mode: "insensitive" } },
        ],
      },
      include: {
        items: true,
        payment: {
          select: {
            provider: true,
            transactionReference: true,
            verifiedReference: true,
            officialReceiptUrl: true,
            cbeReceiptToken: true,
            sourceUrl: true,
          },
        },
        receipts: {
          orderBy: { submittedAt: "desc" },
          take: 1,
          select: {
            id: true,
            provider: true,
            status: true,
            verificationSource: true,
            rejectionReason: true,
            failureReason: true,
            resubmissionRequested: true,
            transactionReference: true,
            extractedReference: true,
            extractedQrData: true,
            officialReceiptUrl: true,
            cbeReceiptToken: true,
          },
        },
      },
    });

    if (!order) {
      throw new AppError({
        message: "No matching order found for that order number and email address.",
        statusCode: HTTP_STATUS.NOT_FOUND,
        code: "ORDER_NOT_FOUND",
      });
    }

    return this.mapOrder(order);
  }

  private async resolveAuthoritativeItemPriceETB(item: {
    productId: string;
    colorwayId?: string;
    colorwayName?: string;
    size?: number;
    unitPriceETB?: number;
  }): Promise<number> {
    const product = await prisma.product.findUnique({ where: { id: item.productId } });
    if (!product) {
      return Number(item.unitPriceETB ?? 0);
    }

    let variant =
      item.colorwayId && typeof item.size === "number"
        ? await prisma.productVariant.findFirst({
            where: {
              productId: item.productId,
              colorwayId: item.colorwayId,
              size: item.size,
            },
          })
        : null;

    if (!variant && item.colorwayName && typeof item.size === "number") {
      variant = await prisma.productVariant.findFirst({
        where: {
          productId: item.productId,
          size: item.size,
          colorway: { name: item.colorwayName },
        },
      });
    }

    if (!variant && typeof item.size === "number") {
      variant = await prisma.productVariant.findFirst({
        where: {
          productId: item.productId,
          size: item.size,
        },
      });
    }

    return Number(product.priceETB) + Number(variant?.priceAdjustment ?? 0);
  }

  async calculate(
    items: Array<{
      productId: string;
      colorwayId?: string;
      colorwayName?: string;
      size?: number;
      unitPriceETB?: number;
      quantity: number;
    }>,
    deliverySpeed = "standard",
    promoCode?: string,
  ) {
    let subtotalETB = 0;

    for (const item of items) {
      const unitPrice = await this.resolveAuthoritativeItemPriceETB(item);
      subtotalETB += unitPrice * item.quantity;
    }

    const settings = await prisma.storeSetting.findUnique({ where: { id: "default" } });
    const freeThreshold = Number(settings?.freeDeliveryThresholdETB ?? 0);
    const standardFee = Number(settings?.standardAddisDeliveryFeeETB ?? 0);
    const vipFee = Number(settings?.vipTwoHourDeliveryFeeETB ?? 450);

    const deliveryFeeETB = deliverySpeed === "vip" ? vipFee : (standardFee === 0 || subtotalETB >= freeThreshold) ? 0 : standardFee;
    let discountETB = 0;

    if (promoCode) {
      const coupon = await prisma.coupon.findUnique({
        where: { code: promoCode.trim().toUpperCase() },
      });
      if (coupon && coupon.isActive) {
        if (subtotalETB >= Number(coupon.minimumOrderAmount)) {
          if (coupon.discountType === "percent") {
            discountETB = Math.round((subtotalETB * Number(coupon.discountValue)) / 100);
          } else {
            discountETB = Number(coupon.discountValue);
          }
          if (coupon.maximumDiscount) {
            discountETB = Math.min(discountETB, Number(coupon.maximumDiscount));
          }
        }
      }
    }

    const totalETB = Math.max(0, subtotalETB + deliveryFeeETB - discountETB);

    return {
      subtotalETB,
      deliveryFeeETB,
      discountETB,
      totalETB,
    };
  }

  async createOrder(
    userId: string | undefined,
    payload: CreateOrderPayload,
    guestSessionId?: string,
  ) {
    if (!payload.items || payload.items.length === 0) {
      throw new AppError({
        message: "Cannot place order with empty items",
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: "EMPTY_ORDER",
      });
    }

    const authoritativePrices = await Promise.all(
      payload.items.map((item) => this.resolveAuthoritativeItemPriceETB(item)),
    );

    // Backend calculation of prices
    const calc = await this.calculate(
      payload.items.map((i) => ({
        productId: i.productId,
        colorwayId: i.colorwayId,
        colorwayName: i.colorwayName,
        size: i.size,
        unitPriceETB: i.unitPriceETB,
        quantity: i.quantity,
      })),
      payload.deliverySpeed,
      payload.promoCode,
    );

    const orderNumber = `AG-${Math.floor(1000 + Math.random() * 9000)}`;

    const providerCode = mapProviderCodeFromMethod(payload.paymentMethod);

    const trackingEvents = [
      {
        step: "Order Placed (Pending Payment)",
        description:
          providerCode === "cod"
            ? "Order logged for Cash / POS settlement on delivery after payment review."
            : `Order placed via ${providerCode.toUpperCase()}. Waiting for instant bank verification before dispatch.`,
        timestamp: "Just now",
        completed: true,
        current: true,
      },
      {
        step: "Payment Verification",
        description: "Confirming transaction directly with the financial institution.",
        timestamp: "Pending",
        completed: false,
      },
      {
        step: payload.deliverySpeed === "vip" ? "Out for 2-Hour VIP Express" : "Dispatched for Addis Delivery",
        description: "Assigned to dispatch rider.",
        timestamp: "Pending",
        completed: false,
      },
      {
        step: "Delivered",
        description: "Delivered to recipient with on-site size check.",
        timestamp: "Pending",
        completed: false,
      },
    ];

    // Use Prisma transaction to atomically create order, decrement stock, and persist notifications
    const newOrder = await prisma.$transaction(async (tx) => {
      const stockAlerts: Array<{
        variantId: string;
        productId: string;
        productName: string;
        colorwayName: string;
        size: number;
        sku: string;
        prevStock: number;
        nextStock: number;
        lowStockThreshold: number;
      }> = [];

      // Verify and decrement stock for the exact (product, colorway, size) variant
      for (const item of payload.items) {
        let variant = item.colorwayId
          ? await tx.productVariant.findFirst({
              where: {
                productId: item.productId,
                colorwayId: item.colorwayId,
                size: item.size,
              },
            })
          : null;

        if (!variant && item.colorwayName) {
          variant = await tx.productVariant.findFirst({
            where: {
              productId: item.productId,
              size: item.size,
              colorway: {
                name: item.colorwayName,
              },
            },
          });
        }

        if (!variant) {
          variant = await tx.productVariant.findFirst({
            where: {
              productId: item.productId,
              size: item.size,
            },
          });
        }

        if (variant) {
          if (variant.stockQuantity < item.quantity) {
            throw new AppError({
              message: `Insufficient stock for ${item.productName} (${item.colorwayName}, EU ${item.size}). Available: ${variant.stockQuantity}`,
              statusCode: HTTP_STATUS.BAD_REQUEST,
              code: "INSUFFICIENT_STOCK",
            });
          }

          const nextStock = variant.stockQuantity - item.quantity;
          await tx.productVariant.update({
            where: { id: variant.id },
            data: {
              stockQuantity: nextStock,
            },
          });

          stockAlerts.push({
            variantId: variant.id,
            productId: item.productId,
            productName: item.productName,
            colorwayName: item.colorwayName,
            size: item.size,
            sku: variant.sku ?? item.sku ?? `AG-${item.size}`,
            prevStock: variant.stockQuantity,
            nextStock,
            lowStockThreshold: variant.lowStockThreshold,
          });
        }
      }

      // If user provided coupon, increment usage count
      if (payload.promoCode) {
        const coupon = await tx.coupon.findUnique({
          where: { code: payload.promoCode.trim().toUpperCase() },
        });
        if (coupon) {
          await tx.coupon.update({
            where: { id: coupon.id },
            data: { usedCount: { increment: 1 } },
          });
        }
      }

      const order = await tx.order.create({
        data: {
          orderNumber,
          userId,
          guestSessionId: userId ? null : (guestSessionId ?? null),
          customerName: payload.customerName,
          customerEmail: payload.customerEmail,
          customerPhone: payload.customerPhone,
          city: payload.city ?? "Addis Ababa",
          subCity: payload.subCity,
          landmark: payload.landmark,
          riderNotes: payload.riderNotes,
          deliverySpeed: payload.deliverySpeed ?? "standard",
          deliveryFeeETB: calc.deliveryFeeETB,
          subtotalETB: calc.subtotalETB,
          discountETB: calc.discountETB,
          promoCode: payload.promoCode,
          totalETB: calc.totalETB,
          paymentMethod: providerCode,
          paymentStatus: providerCode === "cod" ? "cod_due" : "Pending",
          paymentReference: null,
          status: "PendingPayment",
          waybill: `WB-ETH-${Date.now().toString().slice(-6)}`,
          trackingEvents,
          items: {
            create: payload.items.map((item, idx) => {
              const resolvedUnitPrice = authoritativePrices[idx] ?? item.unitPriceETB ?? 4500;
              return {
                productId: item.productId,
                productName: item.productName,
                sku: item.sku ?? `AG-${item.size}`,
                colorwayName: item.colorwayName,
                size: item.size,
                quantity: item.quantity,
                unitPriceETB: resolvedUnitPrice,
                totalPriceETB: resolvedUnitPrice * item.quantity,
                image: item.image,
              };
            }),
          },
        },
        include: { items: true },
      });

      // Create Payment record (strictly Pending until Cheki or audited Admin approval)
      await tx.payment.create({
        data: {
          orderId: order.id,
          userId: userId ?? null,
          provider: providerCode,
          transactionReference: `REF-${orderNumber}`,
          paymentMethod: providerCode,
          amount: calc.totalETB,
          currency: "ETB",
          paymentStatus: order.paymentStatus,
          paidAt: null,
        },
      });

      // Clear cart for authenticated user or guest session
      if (userId) {
        const userCart = await tx.cart.findUnique({ where: { userId } });
        if (userCart) {
          await tx.cartItem.deleteMany({ where: { cartId: userCart.id } });
        }
      } else if (guestSessionId) {
        const guestCart = await tx.cart.findUnique({ where: { guestSessionId } });
        if (guestCart) {
          await tx.cartItem.deleteMany({ where: { cartId: guestCart.id } });
        }
      }

      const itemCount = payload.items.reduce((sum, i) => sum + i.quantity, 0);

      if (userId) {
        await notificationService.createNotification(
          {
            userId,
            title: `Order Placed — #${order.orderNumber}`,
            message:
              providerCode === "cod"
                ? `Your order #${order.orderNumber} (${itemCount} item(s), ${calc.totalETB.toLocaleString()} ETB) has been placed with Cash on Delivery.`
                : `Your order #${order.orderNumber} (${itemCount} item(s), ${calc.totalETB.toLocaleString()} ETB) has been placed. Complete your ${providerCode.toUpperCase()} payment verification to confirm dispatch.`,
            type: "order_placed",
            relatedEntityId: order.orderNumber,
            relatedEntityType: "order",
            metadata: {
              orderId: order.id,
              orderNumber: order.orderNumber,
              totalETB: calc.totalETB,
              paymentMethod: providerCode,
              itemCount,
            },
            idempotencyKey: `order-placed:${order.id}`,
          },
          tx,
        );
      }

      await notificationService.notifyAdmins(
        {
          title: `New Order #${order.orderNumber}`,
          message: `${payload.customerName} placed order #${order.orderNumber} for ${calc.totalETB.toLocaleString()} ETB (${itemCount} pair(s), ${providerCode.toUpperCase()}).`,
          type: "admin_order_placed",
          relatedEntityId: order.orderNumber,
          relatedEntityType: "order",
          metadata: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            customerName: payload.customerName,
            totalETB: calc.totalETB,
            paymentMethod: providerCode,
            itemCount,
            placedAt: order.createdAt.toISOString(),
          },
          idempotencyKey: `admin-order-placed:${order.id}`,
        },
        tx,
      );

      for (const alert of stockAlerts) {
        if (alert.prevStock > 0 && alert.nextStock === 0) {
          await notificationService.notifyAdmins(
            {
              title: `Out of Stock — ${alert.productName}`,
              message: `${alert.productName} (${alert.colorwayName}, EU ${alert.size}) is now out of stock (0 pairs remaining) after order #${order.orderNumber}.`,
              type: "admin_inventory_out_of_stock",
              relatedEntityId: alert.productId,
              relatedEntityType: "product",
              metadata: {
                productId: alert.productId,
                variantId: alert.variantId,
                sku: alert.sku,
                colorwayName: alert.colorwayName,
                size: alert.size,
                stockQuantity: 0,
                lowStockThreshold: alert.lowStockThreshold,
                orderNumber: order.orderNumber,
              },
              idempotencyKey: `admin-inventory-oos:${alert.variantId}:${order.id}`,
            },
            tx,
          );
        } else if (
          alert.nextStock > 0 &&
          alert.prevStock > alert.lowStockThreshold &&
          alert.nextStock <= alert.lowStockThreshold
        ) {
          await notificationService.notifyAdmins(
            {
              title: `Low Stock Alert — ${alert.productName}`,
              message: `${alert.productName} (${alert.colorwayName}, EU ${alert.size}) reached low-stock threshold (${alert.nextStock} pair(s) remaining; threshold: ${alert.lowStockThreshold}).`,
              type: "admin_inventory_low_stock",
              relatedEntityId: alert.productId,
              relatedEntityType: "product",
              metadata: {
                productId: alert.productId,
                variantId: alert.variantId,
                sku: alert.sku,
                colorwayName: alert.colorwayName,
                size: alert.size,
                stockQuantity: alert.nextStock,
                lowStockThreshold: alert.lowStockThreshold,
                orderNumber: order.orderNumber,
              },
              idempotencyKey: `admin-inventory-low:${alert.variantId}:${order.id}`,
            },
            tx,
          );
        }
      }

      return order;
    });

    void notificationService.flushOutbox();

    return this.mapOrder(newOrder);
  }

  async updateOrderStatus(idOrNumber: string, status: string, courierName?: string) {
    const normalized = idOrNumber.replace(/^#/, "").trim();
    const existing = await prisma.order.findFirst({
      where: {
        OR: [{ id: normalized }, { orderNumber: normalized }, { orderNumber: `AG-${normalized}` }],
      },
      include: { items: true },
    });

    if (!existing) {
      throw new AppError({
        message: `Order #${idOrNumber} not found`,
        statusCode: HTTP_STATUS.NOT_FOUND,
        code: "ORDER_NOT_FOUND",
      });
    }

    const protectedStatuses = new Set([
      "Confirmed",
      "Processing",
      "Shipped",
      "Delivered",
      "confirmed",
      "packed",
      "out_for_delivery",
      "shipped_regional",
      "delivered",
    ]);

    if (
      protectedStatuses.has(status) &&
      existing.paymentMethod !== "cod" &&
      existing.paymentStatus !== "Paid" &&
      existing.paymentStatus !== "verified"
    ) {
      throw new AppError({
        message: "Order cannot be confirmed or dispatched before payment verification succeeds.",
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: "PAYMENT_NOT_VERIFIED",
      });
    }

    const effectiveCourier = courierName ?? existing.courierName;
    const statusNotification = mapOrderStatusNotification(
      status,
      existing.orderNumber,
      effectiveCourier,
    );
    const statusChanged = existing.status.toLowerCase() !== status.trim().toLowerCase();

    const updated = await prisma.$transaction(async (tx) => {
      // Restore stock if admin transitions a non-cancelled order to cancelled
      if (
        status.trim().toLowerCase() === "cancelled" &&
        existing.status.toLowerCase() !== "cancelled"
      ) {
        for (const item of existing.items) {
          if (!item.productId) continue;
          const variant = await tx.productVariant.findFirst({
            where: {
              productId: item.productId,
              size: item.size,
              colorway: { name: item.colorwayName },
            },
          });
          if (variant) {
            await tx.productVariant.update({
              where: { id: variant.id },
              data: { stockQuantity: { increment: item.quantity } },
            });
          }
        }
      }

      const nextTrackingEvents =
        statusChanged && statusNotification
          ? appendOrderTrackingEvent(
              existing.trackingEvents,
              statusNotification.trackingStep,
              statusNotification.trackingDescription,
            )
          : undefined;

      const updatedOrder = await tx.order.update({
        where: { id: existing.id },
        data: {
          status,
          courierName: effectiveCourier,
          ...(nextTrackingEvents ? { trackingEvents: nextTrackingEvents } : {}),
        },
        include: {
          items: true,
          payment: {
            select: {
              provider: true,
              transactionReference: true,
              verifiedReference: true,
              officialReceiptUrl: true,
              cbeReceiptToken: true,
              sourceUrl: true,
            },
          },
          receipts: {
            orderBy: { submittedAt: "desc" },
            take: 1,
            select: {
              id: true,
              provider: true,
              status: true,
              verificationSource: true,
              rejectionReason: true,
              failureReason: true,
              resubmissionRequested: true,
              transactionReference: true,
              extractedReference: true,
              extractedQrData: true,
              officialReceiptUrl: true,
              cbeReceiptToken: true,
            },
          },
        },
      });

      if (statusChanged && statusNotification && existing.userId) {
        await notificationService.createNotification(
          {
            userId: existing.userId,
            title: statusNotification.title,
            message: statusNotification.message,
            type: statusNotification.type,
            relatedEntityId: existing.orderNumber,
            relatedEntityType: "order",
            metadata: {
              orderId: existing.id,
              orderNumber: existing.orderNumber,
              status,
              courierName: effectiveCourier ?? null,
            },
            idempotencyKey: `order-status:${existing.id}:${status.trim().toLowerCase()}:${existing.updatedAt.getTime()}`,
          },
          tx,
        );
      }

      return updatedOrder;
    });

    void notificationService.flushOutbox();

    return this.mapOrder(updated);
  }

  async cancelOrder(
    idOrNumber: string,
    actor: { userId: string; role: "CUSTOMER" | "ADMIN" },
    reason?: string,
  ) {
    const normalized = idOrNumber.replace(/^#/, "").trim();
    const existing = await prisma.order.findFirst({
      where: {
        OR: [{ id: normalized }, { orderNumber: normalized }, { orderNumber: `AG-${normalized}` }],
      },
      include: { items: true },
    });

    if (!existing) {
      throw new AppError({
        message: `Order #${idOrNumber} not found`,
        statusCode: HTTP_STATUS.NOT_FOUND,
        code: "ORDER_NOT_FOUND",
      });
    }

    if (actor.role !== "ADMIN" && existing.userId !== actor.userId) {
      throw new AppError({
        message: "You do not have permission to cancel this order",
        statusCode: HTTP_STATUS.FORBIDDEN,
        code: "FORBIDDEN",
      });
    }

    const currentStatus = existing.status.toLowerCase();
    if (currentStatus === "cancelled") {
      throw new AppError({
        message: `Order #${existing.orderNumber} is already cancelled`,
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: "ORDER_ALREADY_CANCELLED",
      });
    }

    const nonCancellable = new Set([
      "shipped",
      "shipped_regional",
      "out_for_delivery",
      "delivered",
    ]);
    if (nonCancellable.has(currentStatus)) {
      throw new AppError({
        message: "Orders that have already been dispatched or delivered cannot be cancelled online",
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: "ORDER_CANNOT_BE_CANCELLED",
      });
    }

    const cancelReason = reason?.trim() || "Cancelled by customer";

    const updated = await prisma.$transaction(async (tx) => {
      for (const item of existing.items) {
        if (!item.productId) continue;
        const variant = await tx.productVariant.findFirst({
          where: {
            productId: item.productId,
            size: item.size,
            colorway: { name: item.colorwayName },
          },
        });
        if (variant) {
          await tx.productVariant.update({
            where: { id: variant.id },
            data: { stockQuantity: { increment: item.quantity } },
          });
        }
      }

      const updatedOrder = await tx.order.update({
        where: { id: existing.id },
        data: {
          status: "Cancelled",
          trackingEvents: appendOrderTrackingEvent(
            existing.trackingEvents,
            "Order Cancelled",
            cancelReason,
          ),
        },
        include: {
          items: true,
          payment: {
            select: {
              provider: true,
              transactionReference: true,
              verifiedReference: true,
              officialReceiptUrl: true,
              cbeReceiptToken: true,
              sourceUrl: true,
            },
          },
          receipts: {
            orderBy: { submittedAt: "desc" },
            take: 1,
            select: {
              id: true,
              provider: true,
              status: true,
              verificationSource: true,
              rejectionReason: true,
              failureReason: true,
              resubmissionRequested: true,
              transactionReference: true,
              extractedReference: true,
              extractedQrData: true,
              officialReceiptUrl: true,
              cbeReceiptToken: true,
            },
          },
        },
      });

      if (existing.userId) {
        await notificationService.createNotification(
          {
            userId: existing.userId,
            title: `Order Cancelled — #${existing.orderNumber}`,
            message: `Your order #${existing.orderNumber} has been cancelled (${cancelReason}). Reserved stock has been released.`,
            type: "order_cancelled",
            relatedEntityId: existing.orderNumber,
            relatedEntityType: "order",
            metadata: {
              orderId: existing.id,
              orderNumber: existing.orderNumber,
              reason: cancelReason,
            },
            idempotencyKey: `order-cancelled:${existing.id}`,
          },
          tx,
        );
      }

      await notificationService.notifyAdmins(
        {
          title: `Order Cancelled — #${existing.orderNumber}`,
          message: `${existing.customerName} cancelled order #${existing.orderNumber} (${Number(existing.totalETB).toLocaleString()} ETB). Reason: ${cancelReason}.`,
          type: "admin_order_cancelled",
          relatedEntityId: existing.orderNumber,
          relatedEntityType: "order",
          metadata: {
            orderId: existing.id,
            orderNumber: existing.orderNumber,
            customerName: existing.customerName,
            totalETB: Number(existing.totalETB),
            reason: cancelReason,
            cancelledAt: new Date().toISOString(),
          },
          idempotencyKey: `admin-order-cancelled:${existing.id}`,
        },
        tx,
      );

      return updatedOrder;
    });

    void notificationService.flushOutbox();

    return this.mapOrder(updated);
  }

  async verifyPayment(idOrNumber: string, reference: string, paymentStatus = "Paid") {
    const normalized = idOrNumber.replace(/^#/, "").trim();
    const existing = await prisma.order.findFirst({
      where: {
        OR: [{ id: normalized }, { orderNumber: normalized }, { orderNumber: `AG-${normalized}` }],
      },
      include: { payment: true },
    });

    if (!existing) {
      throw new AppError({
        message: `Order #${idOrNumber} not found`,
        statusCode: HTTP_STATUS.NOT_FOUND,
        code: "ORDER_NOT_FOUND",
      });
    }

    const normInputStatus = paymentStatus.trim().toLowerCase();
    const nextPaymentStatus =
      normInputStatus === "verified" || normInputStatus === "paid"
        ? "Paid"
        : normInputStatus === "refunded"
          ? "Refunded"
          : normInputStatus === "refund_initiated" || normInputStatus === "refundinitiated"
            ? "RefundInitiated"
            : normInputStatus === "failed" || normInputStatus === "rejected"
              ? "Failed"
              : paymentStatus;
    const isPaid = nextPaymentStatus === "Paid";
    const isRefundInitiated = nextPaymentStatus === "RefundInitiated";
    const isRefunded = nextPaymentStatus === "Refunded";
    const isFailed = nextPaymentStatus === "Failed";

    const officialLink = resolveOfficialReceiptLink({
      provider: existing.payment?.provider || existing.paymentMethod,
      transactionReference: reference,
      officialReceiptUrl: existing.payment?.officialReceiptUrl ?? null,
      sourceUrl: existing.payment?.sourceUrl ?? null,
      cbeReceiptToken: existing.payment?.cbeReceiptToken ?? null,
    });

    const now = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.upsert({
        where: { orderId: existing.id },
        update: {
          paymentStatus: nextPaymentStatus,
          transactionReference: reference,
          officialReceiptUrl: officialLink.officialReceiptUrl,
          cbeReceiptToken: officialLink.cbeReceiptToken,
          ...(isPaid ? { verificationSource: "admin_manual", failureReason: null } : {}),
          verifiedAt: isPaid ? now : existing.payment?.verifiedAt ?? null,
          paidAt: isPaid ? now : existing.payment?.paidAt ?? null,
          reviewReason: "Updated via admin verification action",
          reviewedAt: now,
        },
        create: {
          orderId: existing.id,
          userId: existing.userId,
          provider: existing.paymentMethod,
          paymentMethod: existing.paymentMethod,
          transactionReference: reference,
          officialReceiptUrl: officialLink.officialReceiptUrl,
          cbeReceiptToken: officialLink.cbeReceiptToken,
          amount: existing.totalETB,
          currency: "ETB",
          paymentStatus: nextPaymentStatus,
          verificationSource: isPaid ? "admin_manual" : "pending",
          verifiedAt: isPaid ? now : null,
          paidAt: isPaid ? now : null,
        },
      });

      if (isPaid) {
        const latestPendingReceipt = await tx.paymentReceipt.findFirst({
          where: {
            orderId: existing.id,
            status: { in: ["Pending", "Processing", "Manual Review"] },
          },
          orderBy: { submittedAt: "desc" },
          select: {
            id: true,
            officialReceiptUrl: true,
            cbeReceiptToken: true,
            extractedReference: true,
            extractedQrData: true,
            provider: true,
          },
        });
        if (latestPendingReceipt) {
          const receiptLink = resolveOfficialReceiptLink({
            provider: latestPendingReceipt.provider || existing.paymentMethod,
            transactionReference: reference,
            extractedReference: latestPendingReceipt.extractedReference,
            officialReceiptUrl:
              officialLink.officialReceiptUrl ?? latestPendingReceipt.officialReceiptUrl,
            sourceUrl: existing.payment?.sourceUrl ?? null,
            cbeReceiptToken:
              officialLink.cbeReceiptToken ?? latestPendingReceipt.cbeReceiptToken,
            qrData: latestPendingReceipt.extractedQrData,
          });
          await tx.paymentReceipt.update({
            where: { id: latestPendingReceipt.id },
            data: {
              status: "Verified",
              transactionReference: reference,
              officialReceiptUrl: receiptLink.officialReceiptUrl,
              cbeReceiptToken: receiptLink.cbeReceiptToken,
              verificationSource: "admin_manual",
              verifiedAmount: Number(existing.totalETB),
              verifiedCurrency: "ETB",
              failureReason: null,
              rejectionReason: null,
              resubmissionRequested: false,
              reviewedAt: now,
              verifiedAt: now,
            },
          });
        }
      }

      const updatedOrder = await tx.order.update({
        where: { id: existing.id },
        data: {
          paymentStatus: nextPaymentStatus,
          paymentReference: reference,
          status: isPaid ? "Confirmed" : existing.status,
          ...(isPaid && existing.status !== "Confirmed"
            ? {
                trackingEvents: appendOrderTrackingEvent(
                  existing.trackingEvents,
                  "Payment Verified & Order Confirmed",
                  `Payment confirmed via ${existing.paymentMethod.toUpperCase()} (Ref: ${reference}).`,
                ),
              }
            : {}),
        },
        include: {
          items: true,
          payment: {
            select: {
              provider: true,
              transactionReference: true,
              verifiedReference: true,
              officialReceiptUrl: true,
              cbeReceiptToken: true,
              sourceUrl: true,
            },
          },
          receipts: {
            orderBy: { submittedAt: "desc" },
            take: 1,
            select: {
              id: true,
              provider: true,
              status: true,
              verificationSource: true,
              rejectionReason: true,
              failureReason: true,
              resubmissionRequested: true,
              transactionReference: true,
              extractedReference: true,
              extractedQrData: true,
              officialReceiptUrl: true,
              cbeReceiptToken: true,
            },
          },
        },
      });

      await tx.paymentVerificationLog.create({
        data: {
          paymentId: payment.id,
          orderId: existing.id,
          userId: existing.userId,
          provider: existing.paymentMethod,
          submittedReference: reference,
          verificationStatus: isPaid ? "ManualApproved" : nextPaymentStatus,
          actorType: "admin",
          reason: "Updated via admin verification action",
        },
      });

      if (isPaid) {
        if (existing.userId) {
          await notificationService.createNotification(
            {
              userId: existing.userId,
              title: `Payment Approved — Order #${existing.orderNumber}`,
              message: `Your payment of ${Number(existing.totalETB).toLocaleString()} ETB (Ref: ${reference}) has been approved and verified.`,
              type: "payment_approved",
              relatedEntityId: existing.orderNumber,
              relatedEntityType: "payment",
              metadata: {
                orderId: existing.id,
                orderNumber: existing.orderNumber,
                paymentId: payment.id,
                reference,
                amountETB: Number(existing.totalETB),
              },
              idempotencyKey: `payment-approved:${payment.id}:${reference}`,
            },
            tx,
          );

          if (existing.status !== "Confirmed") {
            await notificationService.createNotification(
              {
                userId: existing.userId,
                title: `Order Confirmed — #${existing.orderNumber}`,
                message: `Your order #${existing.orderNumber} is now confirmed and queued for dispatch.`,
                type: "order_confirmed",
                relatedEntityId: existing.orderNumber,
                relatedEntityType: "order",
                metadata: {
                  orderId: existing.id,
                  orderNumber: existing.orderNumber,
                },
                idempotencyKey: `order-confirmed:${existing.id}`,
              },
              tx,
            );
          }
        }

        await notificationService.notifyAdmins(
          {
            title: `Payment Verified — Order #${existing.orderNumber}`,
            message: `Payment for ${existing.customerName}'s order #${existing.orderNumber} (${Number(existing.totalETB).toLocaleString()} ETB, Ref: ${reference}) was verified.`,
            type: "admin_payment_verified",
            relatedEntityId: existing.orderNumber,
            relatedEntityType: "payment",
            metadata: {
              orderId: existing.id,
              orderNumber: existing.orderNumber,
              paymentId: payment.id,
              customerName: existing.customerName,
              reference,
              amountETB: Number(existing.totalETB),
            },
            idempotencyKey: `admin-payment-verified:${payment.id}:${reference}`,
          },
          tx,
        );
      } else if (isFailed) {
        if (existing.userId) {
          await notificationService.createNotification(
            {
              userId: existing.userId,
              title: `Payment Rejected — Order #${existing.orderNumber}`,
              message: `Your payment for order #${existing.orderNumber} (Ref: ${reference}) could not be verified. Please verify your transfer details and try again.`,
              type: "payment_rejected",
              relatedEntityId: existing.orderNumber,
              relatedEntityType: "payment",
              metadata: {
                orderId: existing.id,
                orderNumber: existing.orderNumber,
                paymentId: payment.id,
                reference,
              },
              idempotencyKey: `payment-rejected:${payment.id}:${reference}`,
            },
            tx,
          );
        }

        await notificationService.notifyAdmins(
          {
            title: `Payment Rejected — Order #${existing.orderNumber}`,
            message: `Payment for ${existing.customerName}'s order #${existing.orderNumber} (Ref: ${reference}) was marked as failed/rejected.`,
            type: "admin_payment_rejected",
            relatedEntityId: existing.orderNumber,
            relatedEntityType: "payment",
            metadata: {
              orderId: existing.id,
              orderNumber: existing.orderNumber,
              paymentId: payment.id,
              customerName: existing.customerName,
              reference,
            },
            idempotencyKey: `admin-payment-rejected:${payment.id}:${reference}`,
          },
          tx,
        );
      } else if (isRefundInitiated || isRefunded) {
        if (existing.userId) {
          await notificationService.createNotification(
            {
              userId: existing.userId,
              title: isRefunded
                ? `Refund Completed — Order #${existing.orderNumber}`
                : `Refund Initiated — Order #${existing.orderNumber}`,
              message: isRefunded
                ? `Your refund of ${Number(existing.totalETB).toLocaleString()} ETB for order #${existing.orderNumber} has been completed.`
                : `A refund of ${Number(existing.totalETB).toLocaleString()} ETB for order #${existing.orderNumber} has been initiated.`,
              type: isRefunded ? "payment_refund_completed" : "payment_refund_initiated",
              relatedEntityId: existing.orderNumber,
              relatedEntityType: "payment",
              metadata: {
                orderId: existing.id,
                orderNumber: existing.orderNumber,
                paymentId: payment.id,
                reference,
                amountETB: Number(existing.totalETB),
              },
              idempotencyKey: `payment-refund:${payment.id}:${nextPaymentStatus}`,
            },
            tx,
          );
        }
      }

      return updatedOrder;
    });

    void notificationService.flushOutbox();

    return this.mapOrder(updated);
  }
}

export const orderService = new OrderService();

