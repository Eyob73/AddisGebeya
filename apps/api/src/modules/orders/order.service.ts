import { HTTP_STATUS, resolveOfficialReceiptLink } from "@addisgebeya/shared";
import { prisma } from "../../config/database.js";
import { AppError } from "../../utils/app-error.js";

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

  async calculate(items: Array<{ productId: string; quantity: number }>, deliverySpeed = "standard", promoCode?: string) {
    let subtotalETB = 0;

    for (const item of items) {
      const product = await prisma.product.findUnique({ where: { id: item.productId } });
      if (product) {
        subtotalETB += Number(product.priceETB) * item.quantity;
      }
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

  async createOrder(userId: string | undefined, payload: CreateOrderPayload) {
    if (!payload.items || payload.items.length === 0) {
      throw new AppError({
        message: "Cannot place order with empty items",
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: "EMPTY_ORDER",
      });
    }

    // Backend calculation of prices
    const calc = await this.calculate(
      payload.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
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

    // Use Prisma transaction to atomically create order and decrement stock
    const newOrder = await prisma.$transaction(async (tx) => {
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

          await tx.productVariant.update({
            where: { id: variant.id },
            data: {
              stockQuantity: variant.stockQuantity - item.quantity,
            },
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
            create: payload.items.map((item) => ({
              productId: item.productId,
              productName: item.productName,
              sku: item.sku ?? `AG-${item.size}`,
              colorwayName: item.colorwayName,
              size: item.size,
              quantity: item.quantity,
              unitPriceETB: item.unitPriceETB ?? 4500,
              totalPriceETB: (item.unitPriceETB ?? 4500) * item.quantity,
              image: item.image,
            })),
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

      // Clear cart for authenticated user
      if (userId) {
        const userCart = await tx.cart.findUnique({ where: { userId } });
        if (userCart) {
          await tx.cartItem.deleteMany({ where: { cartId: userCart.id } });
        }
      }

      return order;
    });

    return this.mapOrder(newOrder);
  }

  async updateOrderStatus(idOrNumber: string, status: string, courierName?: string) {
    const normalized = idOrNumber.replace(/^#/, "").trim();
    const existing = await prisma.order.findFirst({
      where: {
        OR: [{ id: normalized }, { orderNumber: normalized }, { orderNumber: `AG-${normalized}` }],
      },
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

    const updated = await prisma.order.update({
      where: { id: existing.id },
      data: {
        status,
        courierName: courierName ?? existing.courierName,
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

    const nextPaymentStatus =
      paymentStatus === "verified" || paymentStatus === "paid" || paymentStatus === "Paid"
        ? "Paid"
        : paymentStatus;
    const isPaid = nextPaymentStatus === "Paid";

    const officialLink = resolveOfficialReceiptLink({
      provider: existing.payment?.provider || existing.paymentMethod,
      transactionReference: reference,
      officialReceiptUrl: existing.payment?.officialReceiptUrl ?? null,
      sourceUrl: existing.payment?.sourceUrl ?? null,
      cbeReceiptToken: existing.payment?.cbeReceiptToken ?? null,
    });

    const now = new Date();
    const payment = await prisma.payment.upsert({
      where: { orderId: existing.id },
      update: {
        paymentStatus: nextPaymentStatus,
        transactionReference: reference,
        officialReceiptUrl: officialLink.officialReceiptUrl,
        cbeReceiptToken: officialLink.cbeReceiptToken,
        ...(isPaid ? { verificationSource: "admin_manual", failureReason: null } : {}),
        verifiedAt: isPaid ? now : null,
        paidAt: isPaid ? now : null,
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
      const latestPendingReceipt = await prisma.paymentReceipt.findFirst({
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
        await prisma.paymentReceipt.update({
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

    const updated = await prisma.order.update({
      where: { id: existing.id },
      data: {
        paymentStatus: nextPaymentStatus,
        paymentReference: reference,
        status: isPaid ? "Confirmed" : existing.status,
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

    await prisma.paymentVerificationLog.create({
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

    return this.mapOrder(updated);
  }
}

export const orderService = new OrderService();

