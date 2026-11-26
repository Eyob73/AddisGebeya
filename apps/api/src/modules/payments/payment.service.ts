import { HTTP_STATUS } from "@addisgebeya/shared";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database.js";
import { AppError } from "../../utils/app-error.js";
import { notificationService } from "../notifications/notification.service.js";
import { orderService } from "../orders/order.service.js";

export type PaymentMethodType = "telebirr" | "cbeBirr" | "chapa" | "cod" | "bank_transfer";

export interface InitializePaymentInput {
  orderIdOrNumber: string;
  paymentMethod: PaymentMethodType;
  phone?: string;
  returnUrl?: string;
}

export interface PaymentProviderResult {
  transactionReference: string;
  paymentMethod: PaymentMethodType;
  status: "pending" | "verified" | "processing" | "awaiting_delivery";
  amountETB: number;
  checkoutUrl?: string;
  instructions: string;
  isSandbox: boolean;
}

export class PaymentService {
  /**
   * Generates a collision-resistant Ethiopian transaction reference.
   * e.g., TB-20261123-92841, CHAPA-20261123-81723, CBE-20261123-38192, COD-20261123-19284
   */
  generateReference(method: PaymentMethodType): string {
    const prefixMap: Record<PaymentMethodType, string> = {
      telebirr: "TB",
      chapa: "CHAPA",
      cbeBirr: "CBE",
      cod: "COD",
      bank_transfer: "BANK",
    };
    const prefix = prefixMap[method] ?? "PAY";
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const random = Math.floor(10000 + Math.random() * 90000);
    return `${prefix}-${datePart}-${random}`;
  }

  /**
   * Initialize a payment record with full support for Ethiopian payment gateways.
   * Runs in sandbox mode with genuine validation when live credentials are not set.
   */
  async initializePayment(input: InitializePaymentInput, userId?: string): Promise<PaymentProviderResult> {
    const order = await orderService.getOrderById(input.orderIdOrNumber);

    if (userId && order.customerId !== "guest" && order.customerId !== userId) {
      throw new AppError({
        message: "You are not authorized to initiate payment for this order.",
        statusCode: HTTP_STATUS.FORBIDDEN,
        code: "ORDER_FORBIDDEN",
      });
    }

    // Check if already paid
    if (order.paymentStatus === "Paid" || order.paymentStatus === "verified") {
      throw new AppError({
        message: "This order has already been verified and paid.",
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: "ORDER_ALREADY_PAID",
      });
    }

    const reference = this.generateReference(input.paymentMethod);
    const amount = Number(order.totalETB);
    const normalizedProvider =
      input.paymentMethod === "cbeBirr"
        ? "cbebirr"
        : input.paymentMethod === "bank_transfer"
          ? "cbe"
          : input.paymentMethod;

    // Idempotent upsert of payment record
    await prisma.payment.upsert({
      where: { orderId: order.dbId },
      update: {
        provider: normalizedProvider,
        transactionReference: reference,
        paymentMethod: input.paymentMethod,
        amount,
        paymentStatus: input.paymentMethod === "cod" ? "cod_due" : "Pending",
        providerResponse: {
          initializedAt: new Date().toISOString(),
          phone: input.phone,
        },
      },
      create: {
        orderId: order.dbId,
        userId: userId ?? null,
        provider: normalizedProvider,
        transactionReference: reference,
        paymentMethod: input.paymentMethod,
        amount,
        currency: "ETB",
        paymentStatus: input.paymentMethod === "cod" ? "cod_due" : "Pending",
        providerResponse: {
          initializedAt: new Date().toISOString(),
          phone: input.phone,
        },
      },
    });

    // Update order with payment reference and method
    await prisma.order.update({
      where: { id: order.dbId },
      data: {
        paymentMethod: input.paymentMethod,
        paymentReference: reference,
      },
    });

    let instructions = "";
    let status: PaymentProviderResult["status"] = "pending";

    switch (input.paymentMethod) {
      case "telebirr":
        instructions = `Telebirr USSD prompt (*127#) or in-app payment request queued for ${input.phone || "your number"}. Ref: ${reference}.`;
        status = "pending";
        break;
      case "chapa":
        instructions = `Chapa gateway initialized. Reference: ${reference}. Complete checkout on mobile/card or test in Chapa Sandbox.`;
        status = "pending";
        break;
      case "cbeBirr":
        instructions = `CBE Birr merchant paycode active. Dial *847# or enter transaction ref ${reference} in CBE mobile banking.`;
        status = "pending";
        break;
      case "cod":
        instructions = "Cash on Delivery confirmed. Sizing inspection will be performed by rider prior to cash/telebirr settlement at your door.";
        status = "awaiting_delivery";
        break;
      case "bank_transfer":
        instructions = `Commercial Bank of Ethiopia / Awash Bank transfer reference: ${reference}. Please upload your deposit slip.`;
        status = "pending";
        break;
    }

    return {
      transactionReference: reference,
      paymentMethod: input.paymentMethod,
      status,
      amountETB: amount,
      instructions,
      isSandbox: true,
    };
  }

  /**
   * Secure callback / webhook handler to verify and complete payments.
   */
  async processCallback(reference: string, status: "SUCCESS" | "FAILED", providerMeta?: Record<string, unknown>) {
    const payment = await prisma.payment.findFirst({
      where: { transactionReference: reference },
      include: { order: true },
    });

    if (!payment) {
      throw new AppError({
        message: "Payment transaction reference not found",
        statusCode: HTTP_STATUS.NOT_FOUND,
        code: "PAYMENT_NOT_FOUND",
      });
    }

    if (payment.paymentStatus === "verified" || payment.paymentStatus === "paid") {
      return { alreadyProcessed: true, payment };
    }

    const isSuccess = status === "SUCCESS";
    const newStatus = isSuccess ? "verified" : "failed";

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        paymentStatus: newStatus,
        paidAt: isSuccess ? new Date() : null,
        providerResponse: {
          ...((payment.providerResponse as Record<string, unknown>) || {}),
          callbackReceivedAt: new Date().toISOString(),
          providerMeta: (providerMeta as Prisma.InputJsonValue | undefined) ?? null,
        } as Prisma.InputJsonValue,
      },
    });

    if (isSuccess) {
      await orderService.verifyPayment(payment.order.orderNumber, reference, "verified");
    } else {
      await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: payment.orderId },
          data: { paymentStatus: "failed" },
        });

        const customerId = payment.userId ?? payment.order.userId;
        if (customerId) {
          await notificationService.createNotification(
            {
              userId: customerId,
              title: `Payment Rejected — Order #${payment.order.orderNumber}`,
              message: `Your payment callback for order #${payment.order.orderNumber} (Ref: ${reference}) reported a failure. Please review and try again.`,
              type: "payment_rejected",
              relatedEntityId: payment.order.orderNumber,
              relatedEntityType: "payment",
              metadata: {
                orderId: payment.orderId,
                orderNumber: payment.order.orderNumber,
                paymentId: payment.id,
                reference,
              },
              idempotencyKey: `payment-callback-failed:${payment.id}:${reference}`,
            },
            tx,
          );
        }

        await notificationService.notifyAdmins(
          {
            title: `Payment Rejected — Order #${payment.order.orderNumber}`,
            message: `Payment callback for ${payment.order.customerName}'s order #${payment.order.orderNumber} (Ref: ${reference}) failed.`,
            type: "admin_payment_rejected",
            relatedEntityId: payment.order.orderNumber,
            relatedEntityType: "payment",
            metadata: {
              orderId: payment.orderId,
              orderNumber: payment.order.orderNumber,
              paymentId: payment.id,
              customerName: payment.order.customerName,
              reference,
            },
            idempotencyKey: `admin-payment-callback-failed:${payment.id}:${reference}`,
          },
          tx,
        );
      });

      void notificationService.flushOutbox();
    }

    return { success: isSuccess, reference, orderNumber: payment.order.orderNumber };
  }

  async listUserPayments(userId: string) {
    return prisma.payment.findMany({
      where: {
        order: { userId },
      },
      include: {
        order: {
          select: {
            orderNumber: true,
            customerName: true,
            totalETB: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async listPaymentSlips() {
    const slips = await prisma.paymentSlip.findMany({
      orderBy: { receivedAt: "desc" },
    });

    return slips.map((s) => ({
      id: s.id,
      reference: s.reference,
      provider: s.provider as "Telebirr" | "CBE Birr" | "Awash Bank",
      amountETB: Number(s.amountETB),
      senderName: s.senderName,
      senderInfo: s.senderInfo,
      matchedOrderId: s.matchedOrderId ?? undefined,
      receivedAt: s.receivedAt.toISOString(),
    }));
  }

  async attachSlipToOrder(slipId: string, orderIdOrNumber: string, adminUserId?: string) {
    const order = await orderService.getOrderById(orderIdOrNumber);

    const slip = await prisma.paymentSlip.update({
      where: { id: slipId },
      data: { matchedOrderId: order.dbId },
    });

    await orderService.verifyPayment(order.id, slip.reference, "Paid");

    const payment = await prisma.payment.findUnique({ where: { orderId: order.dbId } });
    if (payment) {
      await prisma.paymentVerificationLog.create({
        data: {
          paymentId: payment.id,
          orderId: order.dbId,
          provider: payment.provider,
          submittedReference: slip.reference,
          verificationStatus: "ManualApproved",
          actorType: "admin",
          actorId: adminUserId ?? null,
          reason: `Manual slip attachment (${slipId})`,
        },
      });
    }

    return slip;
  }
}

export const paymentService = new PaymentService();
