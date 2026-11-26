import { createServer } from "node:http";
import type {
  NotificationDto,
  PaginatedNotificationsResponse,
  SocketConnectionReadyPayload,
  SocketNotificationDeletedPayload,
  SocketNotificationNewPayload,
  SocketNotificationReadAllPayload,
  SocketNotificationReadPayload,
  SocketNotificationSyncedPayload,
} from "@addisgebeya/types";
import { io as ioClient, type Socket } from "socket.io-client";
import { createApp } from "./src/app.js";
import { prisma } from "./src/config/database.js";
import { notificationService } from "./src/modules/notifications/notification.service.js";
import { cloudinaryService } from "./src/modules/media/cloudinary.service.js";
import { ensurePaymentProviderConfigsSeeded } from "./src/modules/payments/payment-providers.seed.js";
import { shutdownOcrWorker } from "./src/modules/payments/receipt-ocr.service.js";
import { getActiveSocketServer, setActiveSocketServer } from "./src/socket/socket.events.js";
import { closeSocketServer, initSocketServer } from "./src/socket/socket.server.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

function waitForSocketEvent<T>(
  socket: Socket,
  eventName: string,
  predicate: (payload: T) => boolean = () => true,
  timeoutMs = 8000,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(eventName, handler);
      reject(new Error(`Timed out waiting for socket event "${eventName}" after ${timeoutMs}ms`));
    }, timeoutMs);

    const handler = (payload: T) => {
      if (predicate(payload)) {
        clearTimeout(timer);
        socket.off(eventName, handler);
        resolve(payload);
      }
    };

    socket.on(eventName, handler);
  });
}

function createValidPngBuffer(): Buffer {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAANSURBVBhXY2Bw9P8PAAJlAZAZIj5CAAAAAElFTkSuQmCC",
    "base64",
  );
}

async function connectSocket(
  baseUrl: string,
  token: string,
): Promise<{ socket: Socket; ready: SocketConnectionReadyPayload }> {
  const socket = ioClient(baseUrl, {
    auth: { token },
    transports: ["websocket"],
    reconnection: true,
    reconnectionDelay: 200,
    forceNew: true,
  });

  const readyPromise = waitForSocketEvent<SocketConnectionReadyPayload>(
    socket,
    "connection:ready",
    () => true,
    8000,
  );

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Socket connect timeout")), 8000);
    socket.once("connect", () => {
      clearTimeout(timer);
      resolve();
    });
    socket.once("connect_error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });

  const ready = await readyPromise;
  return { socket, ready };
}

async function runNotificationE2E() {
  console.info("=========================================================================");
  console.info("=== ADDISGEBEYA REAL-TIME NOTIFICATION SYSTEM END-TO-END TEST SUITE   ===");
  console.info("=========================================================================");

  const app = createApp();
  const httpServer = createServer(app);
  initSocketServer(httpServer);

  const port = 5097;
  await new Promise<void>((resolve) => {
    httpServer.listen(port, () => resolve());
  });

  const originUrl = `http://localhost:${port}`;
  const apiBase = `${originUrl}/api`;
  const v1Base = `${originUrl}/api/v1`;

  const createdUserIds: string[] = [];
  const createdOrderIds: string[] = [];
  const stockRestoreOps: Array<{ variantId: string; previousQty: number }> = [];
  const socketsToClose: Socket[] = [];

  const origUploadSingle = cloudinaryService.uploadSingle.bind(cloudinaryService);
  const origDeleteImage = cloudinaryService.deleteImage.bind(cloudinaryService);

  try {
    await ensurePaymentProviderConfigsSeeded();

    // Stub Cloudinary upload to keep E2E deterministic and offline-safe
    cloudinaryService.uploadSingle = async (_buffer, options) => ({
      secureUrl: `https://res.cloudinary.com/demo/image/authenticated/v1/${options.folder}/${options.filenamePrefix}.png`,
      publicId: `${options.folder}/${options.filenamePrefix}`,
      width: 600,
      height: 400,
      bytes: 1200,
      format: "png",
    });
    cloudinaryService.deleteImage = async () => {};

    // Ensure test stock variant with enough stock to trigger low-stock and out-of-stock transitions cleanly
    const variant = await prisma.productVariant.findFirst({
      where: { stockQuantity: { gte: 4 } },
      include: { product: true, colorway: true },
    });
    assert(variant, "Need a product variant with stockQuantity >= 4 in database");

    const ts = Date.now();
    const customerAEmail = `notif.a.${ts}@example.com`;
    const customerBEmail = `notif.b.${ts}@example.com`;
    const password = "TestPassword123!";

    // Login as seeded admin
    console.info("\n[Test 1] Authenticate seeded Admin and test Socket.IO auth security...");
    const adminLoginRes = await fetch(`${v1Base}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@addisgebeya.com", password: "AdminPass123!" }),
    });
    const adminLogin = await adminLoginRes.json();
    assert(adminLoginRes.status === 200 && adminLogin.data?.accessToken, "Admin login failed");
    const adminToken: string = adminLogin.data.accessToken;
    const adminUserId: string = adminLogin.data.user.id;

    // 1a. Reject unauthenticated socket connection
    await new Promise<void>((resolve, reject) => {
      const badSocket = ioClient(originUrl, {
        transports: ["websocket"],
        reconnection: false,
        forceNew: true,
      });
      socketsToClose.push(badSocket);
      badSocket.once("connect", () => reject(new Error("Unauthenticated socket should NOT connect")));
      badSocket.once("connect_error", () => {
        badSocket.disconnect();
        resolve();
      });
    });
    console.info("✓ Unauthenticated Socket.IO connection rejected");

    // 1b. Connect authenticated Admin socket and verify rooms
    const { socket: adminSocket, ready: adminReady } = await connectSocket(originUrl, adminToken);
    socketsToClose.push(adminSocket);
    assert(adminReady.userId === adminUserId, "Admin socket identity mismatch");
    assert(adminReady.role === "ADMIN", "Admin socket role mismatch");
    assert(adminReady.rooms.includes(`user:${adminUserId}`), "Admin missing user room");
    assert(adminReady.rooms.includes("role:ADMIN"), "Admin missing role:ADMIN room");
    console.info("✓ Admin socket authenticated and joined user & role:ADMIN rooms");

    // 2. Register Customer A -> Admin receives real-time customer registration notification
    console.info("\n[Test 2] New customer registration triggers instant admin notification...");
    const adminCustNotifPromise = waitForSocketEvent<SocketNotificationNewPayload>(
      adminSocket,
      "notification:new",
      (p) => p.notification.type === "admin_customer_registered",
    );

    const regARes = await fetch(`${v1Base}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Selam Tester",
        email: customerAEmail,
        phone: "+251911223344",
        password,
        subCity: "Bole (Rwanda / Edna / Japan / Atlas)",
      }),
    });
    const regA = await regARes.json();
    assert(regARes.status === 201 && regA.data?.accessToken, "Customer A registration failed");
    const customerAToken: string = regA.data.accessToken;
    const customerAId: string = regA.data.user.id;
    createdUserIds.push(customerAId);

    const adminCustNotif = await adminCustNotifPromise;
    assert(
      adminCustNotif.notification.relatedEntityId === customerAId,
      "Admin registration notification missing customer ID",
    );
    console.info(`✓ Admin received real-time registration alert: "${adminCustNotif.notification.title}"`);

    // Register Customer B for isolation tests
    const regBRes = await fetch(`${v1Base}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Dawit Tester",
        email: customerBEmail,
        phone: "+251922334455",
        password,
      }),
    });
    const regB = await regBRes.json();
    assert(regBRes.status === 201 && regB.data?.accessToken, "Customer B registration failed");
    const customerBToken: string = regB.data.accessToken;
    const customerBId: string = regB.data.user.id;
    createdUserIds.push(customerBId);

    // 3. Connect two sockets (multi-tab) for Customer A and verify room isolation
    console.info("\n[Test 3] Multi-tab customer sockets + room-hijack prevention...");
    const { socket: custTab1, ready: custReady1 } = await connectSocket(originUrl, customerAToken);
    const { socket: custTab2 } = await connectSocket(originUrl, customerAToken);
    socketsToClose.push(custTab1, custTab2);
    assert(custReady1.role === "CUSTOMER", "Customer role mismatch");
    assert(!custReady1.rooms.includes("role:ADMIN"), "Customer must NEVER join role:ADMIN");
    assert(!custReady1.rooms.includes(`user:${customerBId}`), "Customer A joined Customer B room");

    // Attempt unauthorized room join
    const joinBlocked = await new Promise<{ success: boolean; code?: string }>((resolve) => {
      custTab1.emit("join", { room: `user:${customerBId}` }, (ack: { success: boolean; code?: string }) => {
        resolve(ack);
      });
    });
    assert(joinBlocked.success === false && joinBlocked.code === "FORBIDDEN", "Room join was not blocked");
    console.info("✓ Multi-tab Customer A connected & cross-user room join blocked");

    // 4. Place order that triggers Low Stock & Out of Stock + Customer & Admin instant notifications
    console.info("\n[Test 4] Place order -> customer & admin notifications + low/out-of-stock alerts...");
    stockRestoreOps.push({ variantId: variant.id, previousQty: variant.stockQuantity });

    // Set variant stock to lowStockThreshold + 1 first, then place order for 1 (hits threshold) and 1 (hits 0)
    const threshold = Math.max(1, variant.lowStockThreshold);
    await prisma.productVariant.update({
      where: { id: variant.id },
      data: { stockQuantity: threshold + 1 },
    });

    const custOrderPlacedPromise1 = waitForSocketEvent<SocketNotificationNewPayload>(
      custTab1,
      "notification:new",
      (p) => p.notification.type === "order_placed",
    );
    const custOrderPlacedPromise2 = waitForSocketEvent<SocketNotificationNewPayload>(
      custTab2,
      "notification:new",
      (p) => p.notification.type === "order_placed",
    );
    const adminOrderPlacedPromise = waitForSocketEvent<SocketNotificationNewPayload>(
      adminSocket,
      "notification:new",
      (p) => p.notification.type === "admin_order_placed",
    );
    const adminLowStockPromise = waitForSocketEvent<SocketNotificationNewPayload>(
      adminSocket,
      "notification:new",
      (p) => p.notification.type === "admin_inventory_low_stock",
    );

    const order1Res = await fetch(`${apiBase}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customerAToken}`,
      },
      body: JSON.stringify({
        customerName: "Selam Tester",
        customerPhone: "+251911223344",
        customerEmail: customerAEmail,
        subCity: "Bole",
        landmark: "Near Atlas Hotel",
        deliverySpeed: "standard",
        paymentMethod: "cbe",
        items: [
          {
            productId: variant.productId,
            productName: variant.product.name,
            colorwayId: variant.colorwayId,
            colorwayName: variant.colorway.name,
            size: variant.size,
            quantity: 1,
            unitPriceETB: Number(variant.product.priceETB),
            image: "https://example.com/shoe.png",
          },
        ],
      }),
    });
    const order1Json = await order1Res.json();
    assert(order1Res.status === 201 && order1Json.data?.dbId, "Order 1 creation failed");
    const order1Number: string = order1Json.data.id;
    createdOrderIds.push(order1Json.data.dbId);

    const [c1, c2, aOrder, aLow] = await Promise.all([
      custOrderPlacedPromise1,
      custOrderPlacedPromise2,
      adminOrderPlacedPromise,
      adminLowStockPromise,
    ]);
    assert(c1.notification.id === c2.notification.id, "Tabs received different notification IDs");
    assert(c1.notification.relatedEntityId === order1Number, "Order number missing in notification");
    assert(aOrder.notification.relatedEntityId === order1Number, "Admin order notification mismatch");
    assert(aLow.notification.relatedEntityId === variant.productId, "Low stock alert product mismatch");
    console.info("✓ Multi-tab customer order_placed + admin_order_placed + admin_inventory_low_stock received");

    // Place second order to hit stockQuantity === 0 -> triggers admin_inventory_out_of_stock
    const adminOosPromise = waitForSocketEvent<SocketNotificationNewPayload>(
      adminSocket,
      "notification:new",
      (p) => p.notification.type === "admin_inventory_out_of_stock",
    );

    const order2Res = await fetch(`${apiBase}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customerAToken}`,
      },
      body: JSON.stringify({
        customerName: "Selam Tester",
        customerPhone: "+251911223344",
        customerEmail: customerAEmail,
        subCity: "Bole",
        landmark: "Near Atlas Hotel",
        deliverySpeed: "standard",
        paymentMethod: "cbe",
        items: [
          {
            productId: variant.productId,
            productName: variant.product.name,
            colorwayId: variant.colorwayId,
            colorwayName: variant.colorway.name,
            size: variant.size,
            quantity: threshold,
            unitPriceETB: Number(variant.product.priceETB),
            image: "https://example.com/shoe.png",
          },
        ],
      }),
    });
    const order2Json = await order2Res.json();
    assert(order2Res.status === 201 && order2Json.data?.dbId, "Order 2 creation failed");
    const order2Number: string = order2Json.data.id;
    createdOrderIds.push(order2Json.data.dbId);

    const aOos = await adminOosPromise;
    assert(aOos.notification.relatedEntityId === variant.productId, "Out-of-stock notification mismatch");
    console.info("✓ admin_inventory_out_of_stock delivered instantly when stock reached 0");

    // 5. Payment receipt submission -> Manual review -> Admin rejection (with reason) -> Replacement -> Admin approval
    console.info("\n[Test 5] Payment receipt submission, manual review, rejection reason, and approval...");
    const custReceiptSubmittedPromise = waitForSocketEvent<SocketNotificationNewPayload>(
      custTab1,
      "notification:new",
      (p) => p.notification.type === "payment_receipt_submitted",
    );
    const adminReceiptSubmittedPromise = waitForSocketEvent<SocketNotificationNewPayload>(
      adminSocket,
      "notification:new",
      (p) => p.notification.type === "admin_payment_receipt_submitted",
    );
    const adminManualReviewPromise = waitForSocketEvent<SocketNotificationNewPayload>(
      adminSocket,
      "notification:new",
      (p) => p.notification.type === "admin_payment_manual_review",
    );

    const fd1 = new FormData();
    fd1.append("receipt", new Blob([createValidPngBuffer()], { type: "image/png" }), "receipt.png");
    fd1.append("orderId", order1Number);
    fd1.append("provider", "cbe");
    fd1.append("autoVerify", "false");
    fd1.append("transactionReference", `FT2611NOTIF${String(ts).slice(-5)}`);

    const subRes = await fetch(`${v1Base}/payment/receipts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${customerAToken}` },
      body: fd1,
    });
    const subJson = await subRes.json();
    assert(subRes.status === 201 && subJson.data?.receipt?.paymentId, "Receipt submission failed");
    const payment1Id: string = subJson.data.receipt.paymentId;

    await Promise.all([custReceiptSubmittedPromise, adminReceiptSubmittedPromise, adminManualReviewPromise]);
    console.info("✓ Receipt submission & manual review notifications delivered to customer & admin");

    // Admin rejects with explicit reason
    const rejectReason = "Transaction reference blurred in uploaded slip";
    const custRejectedPromise = waitForSocketEvent<SocketNotificationNewPayload>(
      custTab1,
      "notification:new",
      (p) => p.notification.type === "payment_rejected",
    );

    const rejectRes = await fetch(`${v1Base}/admin/payments/${payment1Id}/review`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        decision: "request_new_receipt",
        reason: rejectReason,
        requestNewReceipt: true,
      }),
    });
    assert(rejectRes.status === 200, "Admin payment reject failed");
    const custRejected = await custRejectedPromise;
    assert(
      custRejected.notification.message.includes(rejectReason),
      "Rejection notification did not include rejection reason",
    );
    console.info("✓ Customer received payment_rejected with exact rejection reason");

    // Replacement receipt -> Admin approves
    const fd2 = new FormData();
    fd2.append("receipt", new Blob([createValidPngBuffer()], { type: "image/png" }), "receipt2.png");
    fd2.append("orderId", order1Number);
    fd2.append("provider", "cbe");
    fd2.append("autoVerify", "false");
    const approvedRef = `FT2611APR${String(ts).slice(-5)}`;
    fd2.append("transactionReference", approvedRef);

    const sub2Res = await fetch(`${v1Base}/payment/receipts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${customerAToken}` },
      body: fd2,
    });
    assert(sub2Res.status === 201, "Replacement receipt submission failed");

    const custApprovedPromise = waitForSocketEvent<SocketNotificationNewPayload>(
      custTab1,
      "notification:new",
      (p) => p.notification.type === "payment_approved",
    );
    const custConfirmedPromise = waitForSocketEvent<SocketNotificationNewPayload>(
      custTab1,
      "notification:new",
      (p) => p.notification.type === "order_confirmed",
    );
    const adminVerifiedPromise = waitForSocketEvent<SocketNotificationNewPayload>(
      adminSocket,
      "notification:new",
      (p) => p.notification.type === "admin_payment_verified",
    );

    const approveRes = await fetch(`${v1Base}/admin/payments/${payment1Id}/review`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        decision: "approve",
        reason: "Verified manually against CBE statement",
        reference: approvedRef,
      }),
    });
    assert(approveRes.status === 200, "Admin approve failed");
    await Promise.all([custApprovedPromise, custConfirmedPromise, adminVerifiedPromise]);
    console.info("✓ Admin payment approval delivered payment_approved + order_confirmed + admin_payment_verified");

    // 6. Order fulfillment lifecycle notifications
    console.info("\n[Test 6] Order status transitions (Processing -> Shipped -> Out for delivery -> Delivered)...");
    const transitions: Array<{ status: string; expectedType: string; courierName?: string }> = [
      { status: "Processing", expectedType: "order_processing" },
      { status: "Shipped", expectedType: "order_shipped", courierName: "Courier Henok" },
      { status: "out_for_delivery", expectedType: "order_out_for_delivery", courierName: "Courier Henok" },
      { status: "Delivered", expectedType: "order_delivered" },
    ];

    for (const step of transitions) {
      const p = waitForSocketEvent<SocketNotificationNewPayload>(
        custTab1,
        "notification:new",
        (ev) => ev.notification.type === step.expectedType && ev.notification.relatedEntityId === order1Number,
      );
      const patchRes = await fetch(`${v1Base}/orders/${order1Number}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ status: step.status, courierName: step.courierName }),
      });
      assert(patchRes.status === 200, `Failed status update to ${step.status}`);
      await p;
    }
    console.info("✓ All order lifecycle transitions delivered real-time notifications");

    // 7. Customer cancels Order 2 -> Customer & Admin notifications + stock restoration
    console.info("\n[Test 7] Customer cancels order -> customer & admin notifications + stock restored...");
    const custCancelPromise = waitForSocketEvent<SocketNotificationNewPayload>(
      custTab1,
      "notification:new",
      (p) => p.notification.type === "order_cancelled" && p.notification.relatedEntityId === order2Number,
    );
    const adminCancelPromise = waitForSocketEvent<SocketNotificationNewPayload>(
      adminSocket,
      "notification:new",
      (p) => p.notification.type === "admin_order_cancelled" && p.notification.relatedEntityId === order2Number,
    );

    const cancelRes = await fetch(`${v1Base}/orders/${order2Number}/cancel`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customerAToken}`,
      },
      body: JSON.stringify({ reason: "Ordered wrong EU size" }),
    });
    assert(cancelRes.status === 200, "Customer cancel order failed");
    await Promise.all([custCancelPromise, adminCancelPromise]);

    const restoredVariant = await prisma.productVariant.findUnique({ where: { id: variant.id } });
    assert(restoredVariant?.stockQuantity === threshold, "Stock was not restored on cancellation");
    console.info("✓ Customer order cancellation notified both parties and restored variant stock");

    // 8. Refund initiation & completion notifications
    console.info("\n[Test 8] Admin refund initiation & completion notifications...");
    const refundInitPromise = waitForSocketEvent<SocketNotificationNewPayload>(
      custTab1,
      "notification:new",
      (p) => p.notification.type === "payment_refund_initiated",
    );
    const refundInitRes = await fetch(`${v1Base}/admin/payments/${payment1Id}/refund`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ stage: "initiated", reason: "Customer requested size refund" }),
    });
    assert(refundInitRes.status === 200, "Refund initiation failed");
    await refundInitPromise;

    const refundDonePromise = waitForSocketEvent<SocketNotificationNewPayload>(
      custTab1,
      "notification:new",
      (p) => p.notification.type === "payment_refund_completed",
    );
    const refundDoneRes = await fetch(`${v1Base}/admin/payments/${payment1Id}/refund`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ stage: "completed", reason: "Refund settled via CBE transfer" }),
    });
    assert(refundDoneRes.status === 200, "Refund completion failed");
    await refundDonePromise;
    console.info("✓ Refund initiated and completed notifications delivered");

    // 9. API pagination, filtering, unread count, mark read, multi-tab sync, delete, and cross-user security
    console.info("\n[Test 9] REST API filtering, pagination, multi-tab read sync, deletion, & ownership...");
    const listRes = await fetch(`${apiBase}/notifications?page=1&limit=3&isRead=false&type=order`, {
      headers: { Authorization: `Bearer ${customerAToken}` },
    });
    const listJson = (await listRes.json()) as { success: boolean; data: PaginatedNotificationsResponse };
    assert(listRes.status === 200 && listJson.success, "GET /api/notifications failed");
    assert(listJson.data.items.length > 0 && listJson.data.items.length <= 3, "Pagination limit mismatch");
    assert(listJson.data.meta.page === 1, "Pagination page mismatch");
    assert(
      listJson.data.items.every((n) => n.userId === customerAId && !n.isRead),
      "Filter returned wrong user or read items",
    );

    const targetNotifId = listJson.data.items[0]!.id;

    // Cross-user isolation: Customer B must NOT read or delete Customer A's notification
    const forbiddenReadRes = await fetch(`${apiBase}/notifications/${targetNotifId}/read`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${customerBToken}` },
    });
    assert(forbiddenReadRes.status === 403, `Expected 403 for cross-user read, got ${forbiddenReadRes.status}`);

    const forbiddenDeleteRes = await fetch(`${apiBase}/notifications/${targetNotifId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${customerBToken}` },
    });
    assert(forbiddenDeleteRes.status === 403, `Expected 403 for cross-user delete, got ${forbiddenDeleteRes.status}`);

    // Mark as read on API -> Tab 2 receives notification:read immediately
    const tab2ReadPromise = waitForSocketEvent<SocketNotificationReadPayload>(
      custTab2,
      "notification:read",
      (p) => p.id === targetNotifId,
    );
    const markReadRes = await fetch(`${apiBase}/notifications/${targetNotifId}/read`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${customerAToken}` },
    });
    assert(markReadRes.status === 200, "PATCH /api/notifications/:id/read failed");
    await tab2ReadPromise;

    // Mark all as read -> Tab 2 receives notification:read_all and unreadCount becomes 0
    const tab2ReadAllPromise = waitForSocketEvent<SocketNotificationReadAllPayload>(
      custTab2,
      "notification:read_all",
    );
    const markAllRes = await fetch(`${apiBase}/notifications/read-all`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${customerAToken}` },
    });
    assert(markAllRes.status === 200, "PATCH /api/notifications/read-all failed");
    await tab2ReadAllPromise;

    const countAfterReadAllRes = await fetch(`${apiBase}/notifications/unread-count`, {
      headers: { Authorization: `Bearer ${customerAToken}` },
    });
    const countAfterReadAllJson = await countAfterReadAllRes.json();
    assert(countAfterReadAllJson.data.unreadCount === 0, "Unread count should be 0 after read-all");

    // Delete notification -> Tab 2 receives notification:deleted
    const tab2DeletedPromise = waitForSocketEvent<SocketNotificationDeletedPayload>(
      custTab2,
      "notification:deleted",
      (p) => p.id === targetNotifId,
    );
    const delRes = await fetch(`${apiBase}/notifications/${targetNotifId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${customerAToken}` },
    });
    assert(delRes.status === 200, "DELETE /api/notifications/:id failed");
    await tab2DeletedPromise;
    console.info("✓ Pagination, filtering, cross-user 403 isolation, multi-tab read/delete sync verified");

    // 10. Idempotency check (duplicate notifications prevented)
    console.info("\n[Test 10] Idempotency & duplicate prevention...");
    const idempKey = `e2e-dedup-test:${ts}`;
    const firstCreate = await notificationService.createNotification({
      userId: customerAId,
      title: "Idempotent Test Notification",
      message: "Should only be created once",
      type: "info",
      idempotencyKey: idempKey,
    });
    const secondCreate = await notificationService.createNotification({
      userId: customerAId,
      title: "Idempotent Test Notification",
      message: "Should only be created once",
      type: "info",
      idempotencyKey: idempKey,
    });
    assert(!firstCreate.deduplicated && secondCreate.deduplicated, "Idempotency check failed");
    assert(firstCreate.notification.id === secondCreate.notification.id, "Duplicate row was created");
    console.info("✓ Duplicate notification creation prevented via idempotencyKey");

    // 11. Persistence after logout/login & reconnection missed-notification sync + outbox delivery reliability
    console.info("\n[Test 11] Logout/login persistence, offline reconnection sync, and outbox delivery...");
    // Test automatic reconnection after client-side network interruption
    const reconnectPromise = waitForSocketEvent<SocketConnectionReadyPayload>(
      custTab1,
      "connection:ready",
      () => true,
      8000,
    );
    custTab1.io.engine.close();
    const reconnectedReady = await reconnectPromise;
    assert(reconnectedReady.userId === customerAId, "Socket failed to auto-reconnect");
    console.info("✓ Socket.IO automatically reconnected after transport interruption");

    custTab1.disconnect();
    custTab2.disconnect();

    // Simulate temporary Socket.IO delivery failure when creating a notification inside a DB transaction
    const savedIo = getActiveSocketServer();
    setActiveSocketServer(null);
    const outboxNotif = await notificationService.createNotification({
      userId: customerAId,
      title: "Offline Outbox Recovery Test",
      message: "Persisted in PostgreSQL while Socket.IO was temporarily offline.",
      type: "info",
      idempotencyKey: `outbox-recovery:${ts}`,
    });
    const pendingOutbox = await prisma.notificationOutbox.findFirst({
      where: { notificationId: outboxNotif.notification.id },
    });
    assert(pendingOutbox && pendingOutbox.status === "pending", "Outbox item should remain pending during outage");

    // Restore Socket.IO server availability
    setActiveSocketServer(savedIo);

    // Re-login Customer A after logout
    await fetch(`${v1Base}/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${customerAToken}` },
    });
    const reloginRes = await fetch(`${v1Base}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: customerAEmail, password }),
    });
    const reloginJson = await reloginRes.json();
    assert(reloginRes.status === 200 && reloginJson.data?.accessToken, "Customer re-login failed");
    const freshToken: string = reloginJson.data.accessToken;

    // Verify notifications persisted across logout/login
    const persistedRes = await fetch(`${apiBase}/notifications?limit=50`, {
      headers: { Authorization: `Bearer ${freshToken}` },
    });
    const persistedJson = (await persistedRes.json()) as { data: PaginatedNotificationsResponse };
    const foundOutboxNotif = persistedJson.data.items.find(
      (n: NotificationDto) => n.id === outboxNotif.notification.id,
    );
    assert(foundOutboxNotif, "Notification missing after logout and login");

    // Reconnect socket & sync missed notifications + flush outbox
    const { socket: reconnectedSocket } = await connectSocket(originUrl, freshToken);
    socketsToClose.push(reconnectedSocket);

    const syncedPayload = await new Promise<SocketNotificationSyncedPayload>((resolve) => {
      reconnectedSocket.emit("notification:sync", {}, (ack: { success: boolean; data: SocketNotificationSyncedPayload }) => {
        resolve(ack.data);
      });
    });
    assert(
      syncedPayload.notifications.some((n) => n.id === outboxNotif.notification.id),
      "Missed notification was not returned on reconnection sync",
    );

    const liveOutboxDeliveryPromise = waitForSocketEvent<SocketNotificationNewPayload>(
      reconnectedSocket,
      "notification:new",
      (p) => p.notification.id === outboxNotif.notification.id,
    );
    await notificationService.flushOutbox();
    await liveOutboxDeliveryPromise;
    const flushedOutbox = await prisma.notificationOutbox.findUnique({
      where: { id: pendingOutbox.id },
    });
    assert(flushedOutbox?.status === "dispatched", "Outbox did not flush after socket recovery");
    console.info("✓ Logout/login persistence, offline reconnection sync, and transactional outbox recovery passed!");

    console.info("\n=========================================================================");
    console.info("=== ALL REAL-TIME NOTIFICATION E2E SCENARIOS PASSED SUCCESSFULLY!     ===");
    console.info("=========================================================================");
  } finally {
    cloudinaryService.uploadSingle = origUploadSingle;
    cloudinaryService.deleteImage = origDeleteImage;

    for (const s of socketsToClose) {
      try {
        s.disconnect();
      } catch {
        // ignore
      }
    }

    // Restore database state cleanly
    for (const op of stockRestoreOps) {
      await prisma.productVariant
        .update({ where: { id: op.variantId }, data: { stockQuantity: op.previousQty } })
        .catch(() => {});
    }
    if (createdOrderIds.length > 0) {
      await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } }).catch(() => {});
    }
    if (createdUserIds.length > 0) {
      await prisma.notification.deleteMany({ where: { userId: { in: createdUserIds } } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }).catch(() => {});
    }
    // Clean up admin notifications generated specifically for test orders/customers
    await prisma.notification
      .deleteMany({
        where: {
          OR: [
            { relatedEntityId: { in: createdUserIds } },
            { message: { contains: "Selam Tester" } },
            { message: { contains: "Dawit Tester" } },
          ],
        },
      })
      .catch(() => {});

    await shutdownOcrWorker().catch(() => {});
    await closeSocketServer();
    if (httpServer.listening) {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }
    await prisma.$disconnect();
  }
}

runNotificationE2E().catch((err) => {
  console.error("\nREAL-TIME NOTIFICATION E2E SUITE FAILED:", err);
  process.exit(1);
});

