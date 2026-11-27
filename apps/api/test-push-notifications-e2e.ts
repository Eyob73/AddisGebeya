import { createServer } from "node:http";
import { buildSafeWebPushPayload, sanitizePushNotificationText } from "@addisgebeya/shared";
import type {
  NotificationDto,
  PushSubscribeResponse,
  PushSubscriptionStatusResponse,
  PushUnsubscribeResponse,
  SocketNotificationNewPayload,
  WebPushNotificationPayload,
} from "@addisgebeya/types";
import { io as ioClient, type Socket } from "socket.io-client";
import { generateVAPIDKeys, getVapidHeaders } from "web-push";
import { createApp } from "./src/app.js";
import { prisma } from "./src/config/database.js";
import { notificationService } from "./src/modules/notifications/notification.service.js";
import { pushNotificationService } from "./src/modules/notifications/push.service.js";
import { closeSocketServer, initSocketServer } from "./src/socket/socket.server.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

async function waitForSocketEvent<T>(
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

async function runPushNotificationE2E() {
  console.info("=========================================================================");
  console.info("=== ADDISGEBEYA WEB PUSH NOTIFICATIONS END-TO-END TEST SUITE          ===");
  console.info("=========================================================================");

  const vapidKeys = generateVAPIDKeys();
  const prevPublicKey = process.env.VAPID_PUBLIC_KEY;
  const prevPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const prevSubject = process.env.VAPID_SUBJECT;

  process.env.VAPID_PUBLIC_KEY = vapidKeys.publicKey;
  process.env.VAPID_PRIVATE_KEY = vapidKeys.privateKey;
  process.env.VAPID_SUBJECT = "mailto:push-test@addisgebeyashoes.et";

  const app = createApp();
  const httpServer = createServer(app);
  initSocketServer(httpServer);

  const port = 5098;
  await new Promise<void>((resolve) => {
    httpServer.listen(port, () => resolve());
  });

  const originUrl = `http://localhost:${port}`;
  const apiBase = `${originUrl}/api`;
  const v1Base = `${originUrl}/api/v1`;

  const createdUserIds: string[] = [];
  const socketsToClose: Socket[] = [];

  try {
    // 1. Register Customer A and Customer B (plus an Admin user for role-based push URL verification)
    const ts = Date.now();
    const password = "PushUserPass123!";

    const regARes = await fetch(`${v1Base}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Push Customer A",
        email: `push-a-${ts}@addisgebeya.test`,
        phone: "+251911777001",
        password,
      }),
    });
    const regAJson = await regARes.json();
    assert(regARes.status === 201 && regAJson.data?.accessToken, "Failed to register User A");
    const userAId: string = regAJson.data.user.id;
    const userAToken: string = regAJson.data.accessToken;
    createdUserIds.push(userAId);

    const regBRes = await fetch(`${v1Base}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Push Customer B",
        email: `push-b-${ts}@addisgebeya.test`,
        phone: "+251911777002",
        password,
      }),
    });
    const regBJson = await regBRes.json();
    assert(regBRes.status === 201 && regBJson.data?.accessToken, "Failed to register User B");
    const userBId: string = regBJson.data.user.id;
    const userBToken: string = regBJson.data.accessToken;
    createdUserIds.push(userBId);

    // 2. Logged-out requests rejected cleanly (401)
    const unauthStatus = await fetch(`${apiBase}/notifications/push/status`);
    assert(unauthStatus.status === 401, "Expected 401 for unauthenticated push/status");
    const unauthSub = await fetch(`${apiBase}/notifications/push/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: "https://fcm.googleapis.com/fcm/send/unauth",
        keys: { p256dh: "B".repeat(65), auth: "A".repeat(22) },
      }),
    });
    assert(unauthSub.status === 401, "Expected 401 for unauthenticated push/subscribe");
    console.info("✓ Unauthenticated push endpoints blocked (401)");

    // 3. Authenticated initial status returns public key & never exposes private key
    const statusRes = await fetch(`${apiBase}/notifications/push/status`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert(statusRes.status === 200, "Expected 200 from GET /api/notifications/push/status");
    const statusBodyText = await statusRes.text();
    assert(!statusBodyText.includes(vapidKeys.privateKey), "Private VAPID key leaked in API response!");
    const statusJson = JSON.parse(statusBodyText) as { data: PushSubscriptionStatusResponse };
    assert(statusJson.data.configured === true, "Push should report configured=true");
    assert(statusJson.data.vapidPublicKey === vapidKeys.publicKey, "VAPID public key mismatch");
    assert(statusJson.data.subscribed === false && statusJson.data.deviceCount === 0, "Expected 0 devices initially");
    console.info("✓ Push status verified & VAPID private key never exposed");

    // 4. Reject invalid non-HTTPS endpoint & short keys
    const invalidSub = await fetch(`${apiBase}/notifications/push/subscribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        endpoint: "http://insecure.example.com/push/123",
        keys: { p256dh: "short", auth: "bad" },
      }),
    });
    assert(invalidSub.status === 400, "Expected 400 for invalid non-HTTPS push subscription");

    // 5. Subscribe multiple devices for User A + deduplicate identical endpoint
    const endpointDev1 = `https://fcm.googleapis.com/fcm/send/dev1-${ts}`;
    const endpointDev2 = `https://updates.push.services.mozilla.com/wpush/v2/dev2-${ts}`;
    const sampleP256dh =
      "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBZuBkr3S3B1xJ_m_qJ6k_test";
    const sampleAuth = "tBHItJI5svbpez7KI4CCXg";

    const sub1Res = await fetch(`${apiBase}/notifications/push/subscribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userAToken}`,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0) Chrome/130.0.0.0",
      },
      body: JSON.stringify({
        endpoint: endpointDev1,
        keys: { p256dh: sampleP256dh, auth: sampleAuth },
      }),
    });
    assert(sub1Res.status === 201, "Expected 201 subscribing Device 1");
    const sub1Json = (await sub1Res.json()) as { data: PushSubscribeResponse };
    assert(sub1Json.data.status.deviceCount === 1, "Expected 1 registered device");

    // Re-registering same endpoint updates without creating duplicate DB rows
    await fetch(`${v1Base}/notifications/push/subscribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        endpoint: endpointDev1,
        keys: { p256dh: sampleP256dh, auth: sampleAuth },
        userAgent: "Chrome Desktop Updated",
      }),
    });

    const sub2Res = await fetch(`${apiBase}/notifications/push/subscribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userAToken}`,
        "User-Agent": "Mozilla/5.0 (Android 14; Mobile) Firefox/131.0",
      },
      body: JSON.stringify({
        endpoint: endpointDev2,
        keys: { p256dh: sampleP256dh, auth: sampleAuth },
      }),
    });
    assert(sub2Res.status === 201, "Expected 201 subscribing Device 2");
    const dbCountA = await prisma.pushSubscription.count({ where: { userId: userAId } });
    assert(dbCountA === 2, `Expected 2 unique devices in DB for User A, got ${dbCountA}`);
    console.info("✓ Multi-device registration & endpoint deduplication in PostgreSQL passed");

    // 6. Cross-user protection: User B cannot unsubscribe User A's endpoint
    const crossUnsub = await fetch(`${apiBase}/notifications/push/unsubscribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userBToken}`,
      },
      body: JSON.stringify({ endpoint: endpointDev2 }),
    });
    assert(crossUnsub.status === 200, "Unsubscribe endpoint should succeed cleanly with 0 removed");
    const crossUnsubJson = (await crossUnsub.json()) as { data: PushUnsubscribeResponse };
    assert(crossUnsubJson.data.removedCount === 0, "User B must never delete User A's subscription");
    assert(
      (await prisma.pushSubscription.count({ where: { userId: userAId } })) === 2,
      "User A devices must remain intact after cross-user unsubscribe attempt",
    );
    console.info("✓ Cross-user subscription protection passed");

    // 7. End-to-end Socket.IO + Web Push delivery, real VAPID encryption headers, lock-screen sanitization & 410 cleanup
    const socket = ioClient(originUrl, {
      auth: { token: userAToken },
      transports: ["websocket"],
      forceNew: true,
    });
    socketsToClose.push(socket);
    await waitForSocketEvent(socket, "connection:ready", () => true, 8000);

    const deliveredRequests: Array<{
      endpoint: string;
      payload: WebPushNotificationPayload;
      urgency?: string;
      vapidAuthHeader: string;
    }> = [];

    pushNotificationService.setSendImplementationForTesting(async (sub, payloadStr, options) => {
      const parsed = JSON.parse(payloadStr) as WebPushNotificationPayload;
      const details = getVapidHeaders(
        new URL(sub.endpoint).origin,
        "mailto:push-test@addisgebeyashoes.et",
        vapidKeys.publicKey,
        vapidKeys.privateKey,
        "aes128gcm",
      );

      // Simulate Device 1 expired (HTTP 410 Gone) while Device 2 succeeds
      if (sub.endpoint === endpointDev1) {
        const err = Object.assign(new Error("Subscription expired"), { statusCode: 410 });
        throw err;
      }

      deliveredRequests.push({
        endpoint: sub.endpoint,
        payload: parsed,
        urgency: options?.urgency,
        vapidAuthHeader: details.Authorization,
      });
    });

    const socketEventPromise = waitForSocketEvent<SocketNotificationNewPayload>(
      socket,
      "notification:new",
      (p) => p.notification.relatedEntityId === "AG-PUSH-1024",
    );

    const notifResult = await notificationService.createNotification({
      userId: userAId,
      title: "Payment Verified — Order #AG-PUSH-1024",
      message:
        "Your payment of 5,850 ETB (Ref: FT2611SECRET99) has been verified. Call +251911223344 or user@secret.et.",
      type: "payment_verified",
      relatedEntityId: "AG-PUSH-1024",
      relatedEntityType: "payment",
      idempotencyKey: `push-e2e-${ts}`,
    });

    const socketPayload = await socketEventPromise;
    assert(
      socketPayload.notification.id === notifResult.notification.id,
      "Socket notification mismatch",
    );

    assert(deliveredRequests.length === 1, `Expected 1 delivered push after dev1 410, got ${deliveredRequests.length}`);
    const sentPush = deliveredRequests[0]!;
    assert(sentPush.endpoint === endpointDev2, "Push must arrive on active Device 2");
    assert(sentPush.vapidAuthHeader.startsWith("vapid t="), "Expected valid VAPID Authorization header");
    assert(sentPush.payload.url === "/account/tracking?order=AG-PUSH-1024", `Unexpected click URL: ${sentPush.payload.url}`);
    assert(!sentPush.payload.body.includes("FT2611SECRET99"), "Sensitive Ref exposed in lock-screen push body!");
    assert(!sentPush.payload.body.includes("+251911223344"), "Sensitive phone exposed in lock-screen push body!");
    assert(!sentPush.payload.body.includes("user@secret.et"), "Sensitive email exposed in lock-screen push body!");
    assert(sentPush.payload.icon === "/images/addisgebeya-logo.png", "Push icon missing");

    // Verify expired 410 Device 1 was removed automatically from PostgreSQL
    const dev1Remaining = await prisma.pushSubscription.findUnique({ where: { endpoint: endpointDev1 } });
    assert(dev1Remaining === null, "Expired HTTP 410 subscription was not purged from PostgreSQL");

    // Verify outbox stamped pushDispatchedAt and flushOutbox does NOT double-send push
    const outboxRow = await prisma.notificationOutbox.findFirst({
      where: { notificationId: notifResult.notification.id },
    });
    assert(outboxRow?.pushDispatchedAt != null, "Expected outbox.pushDispatchedAt to be stamped");
    await notificationService.flushOutbox();
    assert(deliveredRequests.length === 1, "Duplicate push sent after outbox re-flush!");
    console.info("✓ Unified Socket + Web Push delivery, lock-screen privacy, 410 cleanup, and dedup passed");

    // 8. Push preference toggle blocks device pushes when disabled without breaking in-app notifications
    const prefOffRes = await fetch(`${apiBase}/notifications/push/preferences`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({ pushEnabled: false }),
    });
    assert(prefOffRes.status === 200, "Failed to update push preference");

    await notificationService.createNotification({
      userId: userAId,
      title: "Order Confirmed — #AG-PUSH-1024",
      message: "Your order #AG-PUSH-1024 is confirmed for dispatch.",
      type: "order_confirmed",
      relatedEntityId: "AG-PUSH-1024",
      relatedEntityType: "order",
      idempotencyKey: `push-pref-off-${ts}`,
    });
    assert(deliveredRequests.length === 1, "Push should respect pushNotificationsEnabled=false");

    // Re-enable preference and verify shared browser handoff moves endpoint ownership cleanly
    const prefOnRes = await fetch(`${apiBase}/notifications/push/preferences`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({ pushEnabled: true }),
    });
    assert(prefOnRes.status === 200, "Failed to re-enable push preference");

    const handoffRes = await fetch(`${apiBase}/notifications/push/subscribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userBToken}`,
      },
      body: JSON.stringify({
        endpoint: endpointDev2,
        keys: { p256dh: sampleP256dh, auth: sampleAuth },
      }),
    });
    assert(handoffRes.status === 201, "Shared browser endpoint handoff failed");
    const ownerCheck = await prisma.pushSubscription.findUnique({ where: { endpoint: endpointDev2 } });
    assert(ownerCheck?.userId === userBId, "Endpoint ownership must transfer cleanly to User B");

    // Fail-safe check: throwing push error never aborts createNotification
    pushNotificationService.setSendImplementationForTesting(async () => {
      throw new Error("Simulated network outage to push gateway");
    });
    const resilientNotif = await notificationService.createNotification({
      userId: userBId,
      title: "Order Shipped — #AG-PUSH-1025",
      message: "Your order #AG-PUSH-1025 is on its way!",
      type: "order_shipped",
      relatedEntityId: "AG-PUSH-1025",
      relatedEntityType: "order",
      idempotencyKey: `push-fail-safe-${ts}`,
    });
    assert(Boolean(resilientNotif.notification.id), "Notification creation must succeed even if push fails");

    // Admin URL verification using shared payload builder
    const adminPayload = buildSafeWebPushPayload(
      {
        id: "notif-admin-1",
        title: "New Order #AG-9901",
        message: "Abebe placed order #AG-9901.",
        type: "admin_order_placed",
        relatedEntityId: "AG-9901",
        relatedEntityType: "order",
        createdAt: new Date().toISOString(),
      } satisfies Pick<
        NotificationDto,
        "id" | "title" | "message" | "type" | "relatedEntityId" | "relatedEntityType" | "createdAt"
      >,
      "ADMIN",
    );
    assert(adminPayload.url === "/admin/orders?search=AG-9901", "Admin click URL mismatch");
    assert(
      sanitizePushNotificationText("Payment Ref: ABC-99 https://bad.link") === "Payment",
      "Lock-screen sanitizer failed",
    );

    // 9. Self-test push endpoint + explicit unsubscribe
    let testPushHits = 0;
    pushNotificationService.setSendImplementationForTesting(async (sub) => {
      if (sub.endpoint === endpointDev2) {
        testPushHits += 1;
      }
    });
    const testPushRes = await fetch(`${apiBase}/notifications/push/test`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userBToken}`,
      },
      body: "{}",
    });
    assert(testPushRes.status === 201, "Expected 201 from POST /notifications/push/test");
    const testPushJson = (await testPushRes.json()) as {
      data: { push: { sent: number; failed: number; removed: number } };
    };
    assert(testPushHits === 1 && testPushJson.data.push.sent === 1, "Expected test push delivery to User B");

    const unsubB = await fetch(`${apiBase}/notifications/push/unsubscribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userBToken}`,
      },
      body: JSON.stringify({ endpoint: endpointDev2 }),
    });
    assert(unsubB.status === 200, "Unsubscribe failed");
    const unsubBJson = (await unsubB.json()) as { data: PushUnsubscribeResponse };
    assert(unsubBJson.data.removedCount === 1 && unsubBJson.data.status.deviceCount === 0, "Expected 0 devices after unsubscribe");

    // 10. Verify /auth/logout-all clears all push subscriptions for the user
    await fetch(`${apiBase}/notifications/push/subscribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userBToken}`,
      },
      body: JSON.stringify({
        endpoint: `${endpointDev2}-logout-all`,
        keys: { p256dh: sampleP256dh, auth: sampleAuth },
      }),
    });
    assert(
      (await prisma.pushSubscription.count({ where: { userId: userBId } })) === 1,
      "Expected 1 device before logout-all",
    );
    const logoutAllRes = await fetch(`${v1Base}/auth/logout-all`, {
      method: "POST",
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    assert(logoutAllRes.status === 200, "Expected 200 from POST /auth/logout-all");
    assert(
      (await prisma.pushSubscription.count({ where: { userId: userBId } })) === 0,
      "Expected all push subscriptions to be cleared on /auth/logout-all",
    );
    console.info("✓ Preferences, shared-browser handoff, push fault-tolerance, admin click URL, unsubscribe, and logout-all cleanup passed");

    console.info("\n=========================================================================");
    console.info("=== ALL ADDISGEBEYA WEB PUSH NOTIFICATION E2E TESTS PASSED!           ===");
    console.info("=========================================================================");
  } finally {
    pushNotificationService.setSendImplementationForTesting(undefined);

    if (prevPublicKey === undefined) delete process.env.VAPID_PUBLIC_KEY;
    else process.env.VAPID_PUBLIC_KEY = prevPublicKey;
    if (prevPrivateKey === undefined) delete process.env.VAPID_PRIVATE_KEY;
    else process.env.VAPID_PRIVATE_KEY = prevPrivateKey;
    if (prevSubject === undefined) delete process.env.VAPID_SUBJECT;
    else process.env.VAPID_SUBJECT = prevSubject;

    for (const s of socketsToClose) {
      try {
        s.disconnect();
      } catch {
        // ignore
      }
    }

    if (createdUserIds.length > 0) {
      await prisma.pushSubscription.deleteMany({ where: { userId: { in: createdUserIds } } }).catch(() => {});
      await prisma.notification.deleteMany({ where: { userId: { in: createdUserIds } } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }).catch(() => {});
    }
    await prisma.notification
      .deleteMany({ where: { message: { contains: "Push Customer A" } } })
      .catch(() => {});
    await prisma.notification
      .deleteMany({ where: { message: { contains: "Push Customer B" } } })
      .catch(() => {});

    await closeSocketServer();
    if (httpServer.listening) {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }
    await prisma.$disconnect();
  }
}

runPushNotificationE2E().catch((err) => {
  console.error("\nWEB PUSH NOTIFICATION E2E SUITE FAILED:", err);
  process.exit(1);
});

