import { createApp } from "./src/app.js";
import { prisma } from "./src/config/database.js";
import { clearRateLimitBuckets } from "./src/middlewares/rate-limit.middleware.js";
import {
  chekiClient,
  type ChekiBankMetadata,
  type ChekiHealthBankItem,
  type ChekiVerifyOutcome,
  type ChekiVerifyRequest,
} from "./src/modules/payments/cheki.client.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

async function runChekiPaymentSuite() {
  console.info("======================================================================");
  console.info("=== ADDISGEBEYA CHEKI PAYMENT VERIFICATION E2E TEST SUITE (14 CASES) ===");
  console.info("======================================================================");

  const app = createApp();
  const server = app.listen(5097);
  const rootUrl = "http://localhost:5097/api";
  const v1Url = "http://localhost:5097/api/v1";

  const createdOrderIds: string[] = [];
  const createdUserIds: string[] = [];
  const stockRestoreOps: Array<{ variantId: string; incrementBy: number }> = [];

  // Save originals to restore if needed
  const origGetBanks = chekiClient.getBanks.bind(chekiClient);
  const origGetHealth = chekiClient.getHealth.bind(chekiClient);
  const origVerifyReceipt = chekiClient.verifyReceipt.bind(chekiClient);

  const mockLiveBanks: ChekiBankMetadata[] = [
    {
      id: "cbe",
      name: "Commercial Bank of Ethiopia",
      swift: "CBETETAA",
      type: "bank",
      status: "live",
      requiresAccount: false,
      accountDigits: 8,
      color: "#7C3AED",
      initials: "CBE",
      formats: [
        { id: "link", status: "live", label: "Receipt Link", inputs: ["link"], supported: true },
        { id: "receiptId", status: "live", label: "Receipt ID", inputs: ["receiptId"], supported: true },
        { id: "ft", status: "live", label: "FT Reference", inputs: ["reference", "account"], accountDigits: 8, supported: true },
      ],
    },
    {
      id: "telebirr",
      name: "Telebirr",
      type: "mobile",
      status: "live",
      color: "#006838",
      initials: "TB",
      formats: [
        { id: "reference", status: "live", label: "Transaction No", inputs: ["reference"], supported: true },
      ],
    },
    {
      id: "boa",
      name: "Bank of Abyssinia",
      type: "bank",
      status: "live",
      requiresAccount: true,
      accountDigits: 5,
      color: "#D97706",
      initials: "BOA",
      formats: [
        { id: "ft", status: "live", label: "Slip Ref", inputs: ["reference", "account"], accountDigits: 5, supported: true },
        { id: "qr", status: "live", label: "Receipt QR", inputs: ["qr"], supported: true },
      ],
    },
    {
      id: "zemen",
      name: "Zemen Bank",
      type: "bank",
      status: "in-development",
      color: "#B91C1C",
      initials: "ZB",
      formats: [],
    },
  ];

  const mockHealthItems: ChekiHealthBankItem[] = [
    { id: "cbe", name: "Commercial Bank of Ethiopia", status: "reachable", latencyMs: 42 },
    { id: "telebirr", name: "Telebirr", status: "reachable", latencyMs: 38 },
    { id: "boa", name: "Bank of Abyssinia", status: "reachable", latencyMs: 55 },
  ];

  let verifyCallCount = 0;
  let verifyHandler: (req: ChekiVerifyRequest) => Promise<ChekiVerifyOutcome> = async () => ({
    outcome: "rejected",
    httpStatus: 422,
    error: "Unhandled mock",
  });

  const savedConfigs = await prisma.paymentProviderConfig.findMany({
    where: { providerCode: { in: ["cbe", "telebirr", "boa"] } },
  });

  try {
    // Live read-only Cheki smoke check before installing deterministic mock
    console.info("\n[0] Live Cheki Discovery Smoke Check (GET /api/payment/providers)...");
    const liveProvidersRes = await fetch(`${rootUrl}/payment/providers`);
    const liveProvidersJson = await liveProvidersRes.json();
    assert(liveProvidersRes.status === 200 && liveProvidersJson.success, "GET /api/payment/providers failed");
    assert(
      Array.isArray(liveProvidersJson.data?.providers) && liveProvidersJson.data.providers.length >= 1,
      "Expected at least 1 supported payment provider",
    );
    console.info(
      `✓ GET /api/payment/providers returned ${liveProvidersJson.data.providers.length} supported live providers (proxy works cleanly).`,
    );

    // Ensure known test provider configs during deterministic suite (restored in finally)
    await prisma.paymentProviderConfig.update({
      where: { providerCode: "cbe" },
      data: {
        receivingAccountName: "AddisGebeya Footwear Trading PLC",
        receivingAccountNumber: "1000234890123",
        isEnabled: true,
        maxPaymentAgeDays: 30,
      },
    });
    await prisma.paymentProviderConfig.update({
      where: { providerCode: "telebirr" },
      data: {
        receivingAccountName: "AddisGebeya Footwear Trading",
        receivingAccountNumber: "251911234567",
        isEnabled: true,
        maxPaymentAgeDays: 30,
      },
    });
    await prisma.paymentProviderConfig.update({
      where: { providerCode: "boa" },
      data: {
        receivingAccountName: "AddisGebeya Footwear Trading PLC",
        receivingAccountNumber: "148290315",
        accountSuffixDigits: 5,
        isEnabled: true,
        maxPaymentAgeDays: 30,
      },
    });

    // Install deterministic Cheki mock adapter on chekiClient
    chekiClient.getBanks = async () => mockLiveBanks;
    chekiClient.getHealth = async () => mockHealthItems;
    chekiClient.verifyReceipt = async (req: ChekiVerifyRequest) => {
      verifyCallCount += 1;
      return verifyHandler(req);
    };

    // Setup users & sample variant with stock
    const variant = await prisma.productVariant.findFirst({
      where: { stockQuantity: { gte: 20 } },
      include: { product: true, colorway: true },
    });
    assert(variant, "Need at least one product variant with stock >= 20 in PostgreSQL");

    const ts = Date.now();
    const registerUser = async (tag: string, emailSuffix: string) => {
      const res = await fetch(`${v1Url}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Test ${tag}`,
          email: `cheki.${tag.toLowerCase()}.${ts}.${emailSuffix}@example.com`,
          phone: "+251911223344",
          password: "Password123!",
          preferredSize: variant.size,
          subCity: "Bole (Rwanda / Edna / Japan / Atlas)",
        }),
      });
      const json = await res.json();
      assert(res.status === 201 && json.data?.accessToken, `Register failed for ${tag}: ${JSON.stringify(json)}`);
      createdUserIds.push(json.data.user.id);
      return {
        token: json.data.accessToken as string,
        id: json.data.user.id as string,
        email: json.data.user.email as string,
        name: json.data.user.name as string,
      };
    };

    const customer1 = await registerUser("CustomerOne", "1");
    const customer2 = await registerUser("CustomerTwo", "2");

    const adminLoginRes = await fetch(`${v1Url}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@addisgebeya.com", password: "AdminPass123!" }),
    });
    const adminLoginJson = await adminLoginRes.json();
    assert(adminLoginRes.status === 200 && adminLoginJson.data?.user?.role === "admin", "Admin login failed");
    const adminToken = adminLoginJson.data.accessToken as string;
    const adminUserId = adminLoginJson.data.user.id as string;

    const placeOrder = async (token: string, customer: { name: string; email: string }, paymentMethod: string) => {
      const res = await fetch(`${v1Url}/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          customerName: customer.name,
          customerEmail: customer.email,
          customerPhone: "+251911223344",
          city: "Addis Ababa",
          subCity: "Bole (Rwanda / Edna / Japan / Atlas)",
          landmark: "Near Edna Mall",
          deliverySpeed: "standard",
          paymentMethod,
          items: [
            {
              productId: variant.productId,
              productName: variant.product.name,
              sku: variant.product.sku,
              colorwayName: variant.colorway.name,
              size: variant.size,
              quantity: 1,
              unitPriceETB: Number(variant.product.priceETB),
              image: "https://example.com/shoe.png",
            },
          ],
        }),
      });
      const json = await res.json();
      assert(res.status === 201 && json.data?.dbId, `Order creation failed: ${JSON.stringify(json)}`);
      createdOrderIds.push(json.data.dbId);
      stockRestoreOps.push({ variantId: variant.id, incrementBy: 1 });
      return {
        orderId: json.data.dbId as string,
        orderNumber: json.data.id as string,
        totalETB: Number(json.data.totalETB),
        status: json.data.status as string,
        paymentStatus: json.data.paymentStatus as string,
      };
    };

    // Scenario 1: Successful CBE payment verification + order cannot advance before Paid
    console.info("\n[1] Scenario 1: Successful CBE verification & order state transition guard...");
    const order1 = await placeOrder(customer1.token, customer1, "cbe");
    assert(order1.status === "PendingPayment", `Expected PendingPayment, got ${order1.status}`);
    assert(order1.paymentStatus === "Pending", `Expected Pending, got ${order1.paymentStatus}`);

    const blockedDispatch = await fetch(`${v1Url}/orders/${order1.orderNumber}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: "Confirmed" }),
    });
    assert(blockedDispatch.status === 400, `Expected 400 blocking unpaid order confirmation, got ${blockedDispatch.status}`);

    const cbeRef1 = `FT2611CBE001_${ts}`;
    verifyHandler = async (req) => {
      assert(req.bank === "cbe" && req.reference === cbeRef1, "Unexpected CBE request payload");
      return {
        outcome: "ok",
        httpStatus: 200,
        data: {
          success: true,
          verified: true,
          bankCode: "cbe",
          bank: "Commercial Bank of Ethiopia",
          reference: cbeRef1,
          amount: order1.totalETB,
          currency: "ETB",
          senderName: "Abebe Bikila",
          senderAccount: "1000****9821",
          receiverName: "AddisGebeya Footwear Trading PLC",
          receiverAccount: "1000234890123",
          date: new Date().toISOString(),
        },
      };
    };

    const verify1Res = await fetch(`${rootUrl}/payment/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${customer1.token}` },
      body: JSON.stringify({ orderId: order1.orderNumber, provider: "cbe", reference: cbeRef1 }),
    });
    const verify1Json = await verify1Res.json();
    assert(verify1Res.status === 200 && verify1Json.data?.verified === true, `Scenario 1 failed: ${JSON.stringify(verify1Json)}`);
    assert(verify1Json.data.paymentStatus === "Paid" && verify1Json.data.orderStatus === "Confirmed", "Expected Paid + Confirmed");
    console.info("✓ Scenario 1 passed: Unpaid order guarded -> CBE receipt verified -> Paid & Confirmed.");

    // Scenario 2: Successful Telebirr verification when supported
    console.info("\n[2] Scenario 2: Successful Telebirr verification...");
    const order2 = await placeOrder(customer1.token, customer1, "telebirr");
    const tbRef = `TB2611TELE002_${ts}`;
    verifyHandler = async (req) => {
      assert(req.bank === "telebirr", "Expected telebirr provider");
      return {
        outcome: "ok",
        httpStatus: 200,
        data: {
          success: true,
          verified: true,
          bankCode: "telebirr",
          bank: "Telebirr",
          reference: tbRef,
          amount: order2.totalETB,
          currency: "ETB",
          senderName: "Customer One",
          senderAccount: "2519****3344",
          receiverName: "AddisGebeya Footwear Trading",
          receiverAccount: "251911234567",
          date: new Date().toISOString(),
        },
      };
    };
    const verify2Res = await fetch(`${rootUrl}/payment/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${customer1.token}` },
      body: JSON.stringify({ orderId: order2.orderNumber, provider: "telebirr", reference: tbRef }),
    });
    const verify2Json = await verify2Res.json();
    assert(verify2Res.status === 200 && verify2Json.data?.paymentStatus === "Paid", "Scenario 2 Telebirr verification failed");
    console.info("✓ Scenario 2 passed: Telebirr verification succeeded & confirmed order.");

    // Scenario 3: Incorrect transaction reference (Cheki 422 rejected)
    console.info("\n[3] Scenario 3: Incorrect transaction reference...");
    const order3 = await placeOrder(customer1.token, customer1, "cbe");
    verifyHandler = async () => ({
      outcome: "rejected",
      httpStatus: 422,
      error: "Receipt not found",
      checkedUrl: "https://internal.example/secret-check",
    });
    const verify3Res = await fetch(`${rootUrl}/payment/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${customer1.token}` },
      body: JSON.stringify({ orderId: order3.orderNumber, provider: "cbe", reference: `BADREF_${ts}` }),
    });
    const verify3Json = await verify3Res.json();
    assert(verify3Res.status === 422 && verify3Json.code === "VERIFICATION_FAILED", `Expected VERIFICATION_FAILED, got ${JSON.stringify(verify3Json)}`);
    assert(!JSON.stringify(verify3Json).includes("internal.example"), "Must never leak internal checkedUrl to client");
    const dbOrder3 = await prisma.order.findUnique({ where: { id: order3.orderId }, include: { payment: true } });
    assert(dbOrder3?.status === "PendingPayment" && dbOrder3?.payment?.paymentStatus === "Failed", "Expected Failed + PendingPayment");
    console.info("✓ Scenario 3 passed: Incorrect reference -> Failed, PendingPayment, zero URL leak.");

    // Scenario 4: Incorrect payment amount (santim mismatch) -> ReviewRequired
    console.info("\n[4] Scenario 4: Incorrect payment amount (santim precision) -> ReviewRequired...");
    const order4 = await placeOrder(customer1.token, customer1, "cbe");
    verifyHandler = async () => ({
      outcome: "ok",
      httpStatus: 200,
      data: {
        success: true,
        verified: true,
        bankCode: "cbe",
        reference: `FT2611AMT004_${ts}`,
        amount: Number((order4.totalETB - 0.5).toFixed(2)),
        currency: "ETB",
        receiverAccount: "1000234890123",
        receiverName: "AddisGebeya Footwear Trading PLC",
        date: new Date().toISOString(),
      },
    });
    const verify4Res = await fetch(`${rootUrl}/payment/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${customer1.token}` },
      body: JSON.stringify({ orderId: order4.orderNumber, provider: "cbe", reference: `FT2611AMT004_${ts}` }),
    });
    const verify4Json = await verify4Res.json();
    assert(verify4Res.status === 422 && verify4Json.code === "AMOUNT_MISMATCH", `Expected AMOUNT_MISMATCH, got ${JSON.stringify(verify4Json)}`);
    const dbOrder4 = await prisma.order.findUnique({ where: { id: order4.orderId }, include: { payment: true } });
    assert(dbOrder4?.payment?.paymentStatus === "ReviewRequired" && dbOrder4.status === "PendingPayment", "Expected ReviewRequired + PendingPayment");
    console.info("✓ Scenario 4 passed: Amount mismatch flagged as ReviewRequired.");

    // Scenario 5: Wrong receiving account -> ReviewRequired
    console.info("\n[5] Scenario 5: Wrong receiving account -> ReviewRequired...");
    const order5 = await placeOrder(customer1.token, customer1, "cbe");
    verifyHandler = async () => ({
      outcome: "ok",
      httpStatus: 200,
      data: {
        success: true,
        verified: true,
        bankCode: "cbe",
        reference: `FT2611ACC005_${ts}`,
        amount: order5.totalETB,
        currency: "ETB",
        receiverName: "Random Third Party",
        receiverAccount: "1000999999999",
        date: new Date().toISOString(),
      },
    });
    const verify5Res = await fetch(`${rootUrl}/payment/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${customer1.token}` },
      body: JSON.stringify({ orderId: order5.orderNumber, provider: "cbe", reference: `FT2611ACC005_${ts}` }),
    });
    const verify5Json = await verify5Res.json();
    assert(verify5Res.status === 422 && verify5Json.code === "RECEIVING_ACCOUNT_MISMATCH", `Expected RECEIVING_ACCOUNT_MISMATCH, got ${JSON.stringify(verify5Json)}`);
    const dbOrder5 = await prisma.order.findUnique({ where: { id: order5.orderId }, include: { payment: true } });
    assert(dbOrder5?.payment?.paymentStatus === "ReviewRequired" && dbOrder5.status === "PendingPayment", "Expected ReviewRequired");
    console.info("✓ Scenario 5 passed: Wrong receiving account flagged as ReviewRequired.");

    // Scenario 6: Duplicate transaction reference rejected before Cheki call
    console.info("\n[6] Scenario 6: Duplicate transaction reference reuse prevention...");
    const callsBeforeDup = verifyCallCount;
    const verify6Res = await fetch(`${rootUrl}/payment/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${customer1.token}` },
      body: JSON.stringify({
        orderId: order3.orderNumber,
        provider: "cbe",
        reference: `  ${cbeRef1.toLowerCase()}  `,
      }),
    });
    const verify6Json = await verify6Res.json();
    assert(verify6Res.status === 409 && verify6Json.code === "DUPLICATE_TRANSACTION_REFERENCE", `Expected 409 duplicate, got ${JSON.stringify(verify6Json)}`);
    assert(verifyCallCount === callsBeforeDup, "Expected duplicate check to short-circuit before calling Cheki");
    console.info("✓ Scenario 6 passed: Normalized duplicate reference rejected (409) before Cheki call.");

    // Scenario 7: Unsupported payment provider
    console.info("\n[7] Scenario 7: Unsupported payment provider rejected...");
    const verify7Res = await fetch(`${rootUrl}/payment/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${customer1.token}` },
      body: JSON.stringify({ orderId: order3.orderNumber, provider: "zemen", reference: "ZMN123456" }),
    });
    const verify7Json = await verify7Res.json();
    assert(verify7Res.status === 400 && verify7Json.code === "UNSUPPORTED_PAYMENT_PROVIDER", `Expected UNSUPPORTED_PAYMENT_PROVIDER, got ${JSON.stringify(verify7Json)}`);
    console.info("✓ Scenario 7 passed: In-development / unsupported provider rejected (400).");

    // Scenario 8: Bank API unavailable or timeout -> Pending + PendingPayment
    console.info("\n[8] Scenario 8: Bank API unavailable / timeout preserves PendingPayment...");
    verifyHandler = async () => ({
      outcome: "unavailable",
      httpStatus: 503,
      error: "Upstream bank verification timed out",
    });
    const verify8Res = await fetch(`${rootUrl}/payment/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${customer1.token}` },
      body: JSON.stringify({ orderId: order3.orderNumber, provider: "cbe", reference: `FT2611TMP008_${ts}` }),
    });
    const verify8Json = await verify8Res.json();
    assert(verify8Res.status === 503 && verify8Json.code === "VERIFICATION_UNAVAILABLE", `Expected VERIFICATION_UNAVAILABLE, got ${JSON.stringify(verify8Json)}`);
    const dbOrder3After8 = await prisma.order.findUnique({ where: { id: order3.orderId }, include: { payment: true } });
    assert(dbOrder3After8?.status === "PendingPayment" && dbOrder3After8?.payment?.paymentStatus === "Pending", "Expected Pending + PendingPayment after outage");
    console.info("✓ Scenario 8 passed: Outage returns 503 and preserves Pending + PendingPayment.");

    // Scenario 9: Cheki 429 rate limit + internal endpoint rate limiter
    console.info("\n[9] Scenario 9: Cheki rate limit & internal verify rate limiter...");
    verifyHandler = async () => ({
      outcome: "rate_limited",
      httpStatus: 429,
      retryAfterSeconds: 30,
      error: "Rate limit exceeded upstream",
    });
    const verify9Res = await fetch(`${rootUrl}/payment/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${customer1.token}` },
      body: JSON.stringify({ orderId: order3.orderNumber, provider: "cbe", reference: `FT2611RL009_${ts}` }),
    });
    const verify9Json = await verify9Res.json();
    assert(verify9Res.status === 429 && verify9Json.code === "CHEKI_RATE_LIMITED", `Expected CHEKI_RATE_LIMITED, got ${JSON.stringify(verify9Json)}`);

    // Flood endpoint with customer2 to verify local sliding-window rate limiter (>10 req/min)
    clearRateLimitBuckets("payment-verify");
    const orderC2 = await placeOrder(customer2.token, customer2, "cbe");
    let hitRateLimit429 = false;
    for (let i = 0; i < 11; i++) {
      const rlRes = await fetch(`${rootUrl}/payment/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${customer2.token}` },
        body: JSON.stringify({ orderId: orderC2.orderNumber, provider: "cbe", reference: `RL${i}_${ts}` }),
      });
      if (rlRes.status === 429) {
        const body = await rlRes.json();
        if (body.code === "RATE_LIMIT_EXCEEDED" && rlRes.headers.get("retry-after")) {
          hitRateLimit429 = true;
          break;
        }
      }
    }
    assert(hitRateLimit429, "Expected endpoint rate limiter to return 429 RATE_LIMIT_EXCEEDED after 10 attempts");
    clearRateLimitBuckets("payment-verify");
    console.info("✓ Scenario 9 passed: Upstream 429 handled cleanly & endpoint rate limiter enforced.");

    // Scenario 10: Max receipt age window, expired transaction date & decodedOnly QR guard
    console.info("\n[10] Scenario 10: Max receipt age window, expired transaction date & decodedOnly QR guard...");
    const order10 = await placeOrder(customer1.token, customer1, "boa");
    verifyHandler = async () => ({
      outcome: "ok",
      httpStatus: 200,
      data: {
        success: true,
        verified: true,
        decodedOnly: true,
        bankCode: "boa",
        reference: `BOAQR_${ts}`,
      },
    });
    const qrDecodedOnlyRes = await fetch(`${rootUrl}/payment/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${customer1.token}` },
      body: JSON.stringify({ orderId: order10.orderNumber, provider: "boa", qrData: "000201010212..." }),
    });
    assert(qrDecodedOnlyRes.status === 422, "decodedOnly QR payload must NEVER auto-approve");

    verifyHandler = async () => ({
      outcome: "ok",
      httpStatus: 200,
      data: {
        success: true,
        verified: true,
        bankCode: "boa",
        reference: `BOASTALE_${ts}`,
        amount: order10.totalETB,
        currency: "ETB",
        receiverAccount: "****90315",
        receiverName: "AddisGebeya Footwear Trading PLC",
        date: "2024-01-15T10:00:00.000Z",
      },
    });
    const staleDateRes = await fetch(`${rootUrl}/payment/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${customer1.token}` },
      body: JSON.stringify({
        orderId: order10.orderNumber,
        provider: "boa",
        reference: `BOASTALE_${ts}`,
        accountNumber: "90315",
      }),
    });
    const staleDateJson = await staleDateRes.json();
    assert(staleDateRes.status === 422 && staleDateJson.code === "TRANSACTION_EXPIRED", `Expected TRANSACTION_EXPIRED, got ${JSON.stringify(staleDateJson)}`);

    // Verify configurable maxPaymentAgeDays: 8-day-old receipt passes with 30-day window, fails with 5-day window
    const eightDaysAgoIso = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const order10ValidAge = await placeOrder(customer1.token, customer1, "cbe");
    const validAgeRef = `FT2611AGEOK_${ts}`;
    verifyHandler = async () => ({
      outcome: "ok",
      httpStatus: 200,
      data: {
        success: true,
        verified: true,
        bankCode: "cbe",
        reference: validAgeRef,
        amount: order10ValidAge.totalETB,
        currency: "ETB",
        receiverAccount: "1000234890123",
        receiverName: "AddisGebeya Footwear Trading PLC",
        date: eightDaysAgoIso,
      },
    });
    const validAgeRes = await fetch(`${rootUrl}/payment/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${customer1.token}` },
      body: JSON.stringify({ orderId: order10ValidAge.orderNumber, provider: "cbe", reference: validAgeRef }),
    });
    assert(validAgeRes.status === 200, `Expected 8-day receipt to pass under 30-day maxPaymentAgeDays, got ${validAgeRes.status}`);

    // Shrink maxPaymentAgeDays to 5 -> same 8-day age should now reject as TRANSACTION_EXPIRED
    const shrinkRes = await fetch(`${rootUrl}/admin/payment-providers/cbe`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        displayName: "Commercial Bank of Ethiopia (CBE)",
        receivingAccountName: "AddisGebeya Footwear Trading PLC",
        receivingAccountNumber: "1000234890123",
        accountSuffixDigits: 8,
        isEnabled: true,
        maxPaymentAgeDays: 5,
      }),
    });
    assert(shrinkRes.status === 200, "Failed to update CBE maxPaymentAgeDays to 5");

    const order10ExpiredAge = await placeOrder(customer1.token, customer1, "cbe");
    const expiredAgeRef = `FT2611AGEEXP_${ts}`;
    verifyHandler = async () => ({
      outcome: "ok",
      httpStatus: 200,
      data: {
        success: true,
        verified: true,
        bankCode: "cbe",
        reference: expiredAgeRef,
        amount: order10ExpiredAge.totalETB,
        currency: "ETB",
        receiverAccount: "1000234890123",
        receiverName: "AddisGebeya Footwear Trading PLC",
        date: eightDaysAgoIso,
      },
    });
    const expiredAgeRes = await fetch(`${rootUrl}/payment/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${customer1.token}` },
      body: JSON.stringify({ orderId: order10ExpiredAge.orderNumber, provider: "cbe", reference: expiredAgeRef }),
    });
    const expiredAgeJson = await expiredAgeRes.json();
    assert(expiredAgeRes.status === 422 && expiredAgeJson.code === "TRANSACTION_EXPIRED", `Expected 8-day receipt to expire under 5-day limit, got ${JSON.stringify(expiredAgeJson)}`);

    // Also confirm non-duplicate expired ReviewRequired payment is NOT falsely marked isDuplicateReference
    const inspectNonDupRes = await fetch(`${rootUrl}/admin/payments?search=${order10ExpiredAge.orderNumber}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const inspectNonDupJson = await inspectNonDupRes.json();
    assert(
      inspectNonDupJson.data?.items?.[0]?.isDuplicateReference === false,
      "Non-duplicate ReviewRequired payment must NOT be flagged isDuplicateReference: true",
    );

    // Restore 30-day window for remaining scenarios
    await prisma.paymentProviderConfig.update({
      where: { providerCode: "cbe" },
      data: { maxPaymentAgeDays: 30 },
    });
    console.info("✓ Scenario 10 passed: maxPaymentAgeDays enforced cleanly, decodedOnly QR rejected, and no false duplicate warning.");

    // Scenario 11: Customer ownership isolation & unauthenticated access
    console.info("\n[11] Scenario 11: Cross-customer access & unauthenticated protection...");
    const unauthRes = await fetch(`${rootUrl}/payment/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: order1.orderNumber, provider: "cbe", reference: "NOAUTH123" }),
    });
    assert(unauthRes.status === 401, "Expected 401 when unauthenticated");

    const crossVerifyRes = await fetch(`${rootUrl}/payment/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${customer2.token}` },
      body: JSON.stringify({ orderId: order3.orderNumber, provider: "cbe", reference: `HIJACK_${ts}` }),
    });
    assert(crossVerifyRes.status === 403, `Expected 403 cross-customer verify, got ${crossVerifyRes.status}`);

    const crossStatusRes = await fetch(`${rootUrl}/payment/status/${order1.orderNumber}`, {
      headers: { Authorization: `Bearer ${customer2.token}` },
    });
    assert(crossStatusRes.status === 403, `Expected 403 cross-customer status, got ${crossStatusRes.status}`);
    console.info("✓ Scenario 11 passed: Unauthenticated (401) and cross-customer (403) requests blocked.");

    // Scenario 12: Concurrent verification lock & idempotent repeat check
    console.info("\n[12] Scenario 12: Simultaneous race lock & idempotent alreadyPaid response...");
    const raceOrder = await placeOrder(customer1.token, customer1, "cbe");
    const raceRef = `FT2611RACE_${ts}`;
    let raceChekiCalls = 0;
    verifyHandler = async () => {
      raceChekiCalls += 1;
      await new Promise((r) => setTimeout(r, 120));
      return {
        outcome: "ok",
        httpStatus: 200,
        data: {
          success: true,
          verified: true,
          bankCode: "cbe",
          reference: raceRef,
          amount: raceOrder.totalETB,
          currency: "ETB",
          receiverAccount: "1000234890123",
          date: new Date().toISOString(),
        },
      };
    };

    const [r1, r2] = await Promise.all([
      fetch(`${rootUrl}/payment/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${customer1.token}` },
        body: JSON.stringify({ orderId: raceOrder.orderNumber, provider: "cbe", reference: raceRef }),
      }),
      fetch(`${rootUrl}/payment/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${customer1.token}` },
        body: JSON.stringify({ orderId: raceOrder.orderNumber, provider: "cbe", reference: raceRef }),
      }),
    ]);

    const statuses = [r1.status, r2.status].sort((a, b) => a - b);
    assert(
      statuses[0] === 200 && (statuses[1] === 409 || statuses[1] === 200),
      `Expected one 200 and one 409/200 in race, got ${statuses.join(", ")}`,
    );
    assert(raceChekiCalls === 1, `Expected atomic lock to call Cheki only ONCE, called ${raceChekiCalls} times`);

    // Repeat verification after Paid should return alreadyPaid: true without hitting Cheki
    const callsBeforeRepeat = verifyCallCount;
    const repeatRes = await fetch(`${rootUrl}/payment/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${customer1.token}` },
      body: JSON.stringify({ orderId: raceOrder.orderNumber, provider: "cbe", reference: raceRef }),
    });
    const repeatJson = await repeatRes.json();
    assert(repeatRes.status === 200 && repeatJson.data?.alreadyPaid === true, "Expected idempotent alreadyPaid: true");
    assert(verifyCallCount === callsBeforeRepeat, "Repeat verify on Paid order must NOT re-call Cheki");
    console.info("✓ Scenario 12 passed: Concurrent lock prevented double Cheki call; repeat call idempotent.");

    // Scenario 13: Reload persistence check via GET /api/payment/status/:orderId
    console.info("\n[13] Scenario 13: Checkout reload status persistence check...");
    const statusRes = await fetch(`${rootUrl}/payment/status/${order1.orderNumber}`, {
      headers: { Authorization: `Bearer ${customer1.token}` },
    });
    const statusJson = await statusRes.json();
    assert(statusRes.status === 200 && statusJson.data?.paymentStatus === "Paid", "Expected persisted Paid status");
    assert(statusJson.data.orderStatus === "Confirmed", "Expected persisted Confirmed order status");
    assert(statusJson.data.transactionReference === cbeRef1, "Expected persisted transaction reference");
    console.info("✓ Scenario 13 passed: Reloading payment status returns Paid + Confirmed + masked account details.");

    // Scenario 14: Admin inspection, audited manual review & provider configuration
    console.info("\n[14] Scenario 14: Admin ReviewRequired workflow, audit log & Paid lock...");
    const adminListRes = await fetch(`${rootUrl}/admin/payments?status=ReviewRequired&search=${order4.orderNumber}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminListJson = await adminListRes.json();
    assert(adminListRes.status === 200 && adminListJson.data?.items?.length === 1, "Admin failed to list ReviewRequired payment");
    const flaggedPayment = adminListJson.data.items[0];
    assert(Array.isArray(flaggedPayment.logs) && flaggedPayment.logs.length >= 1, "Expected verification attempt logs on payment");

    // Reject review without reason
    const noReasonRes = await fetch(`${rootUrl}/admin/payments/${flaggedPayment.id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ decision: "approve", reason: "ok" }),
    });
    assert(noReasonRes.status === 400, "Admin manual review without meaningful reason must fail (400)");

    // Approve ReviewRequired with proper audit reason
    const approveRef = `FT2611MANUAL004_${ts}`;
    const approveRes = await fetch(`${rootUrl}/admin/payments/${flaggedPayment.id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        decision: "approve",
        reason: "Verified customer paid missing 0.50 ETB in cash at showroom",
        reference: approveRef,
      }),
    });
    const approveJson = await approveRes.json();
    assert(approveRes.status === 200 && approveJson.data?.paymentStatus === "Paid", `Admin approve failed: ${JSON.stringify(approveJson)}`);
    assert(approveJson.data.reviewedByAdminId === adminUserId, "Expected audited admin ID saved");
    assert(
      approveJson.data.logs.some((l: { verificationStatus: string }) => l.verificationStatus === "ManualApproved"),
      "Expected ManualApproved audit log entry",
    );

    // Block overriding already Paid payment
    const overridePaidRes = await fetch(`${rootUrl}/admin/payments/${flaggedPayment.id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ decision: "reject", reason: "Trying to alter settled payment" }),
    });
    assert(overridePaidRes.status === 409, `Expected 409 blocking override of Paid payment, got ${overridePaidRes.status}`);

    // Admin receiving account config read/update check
    const cfgListRes = await fetch(`${rootUrl}/admin/payment-providers`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const cfgListJson = await cfgListRes.json();
    assert(cfgListRes.status === 200 && cfgListJson.data.length >= 12, "Expected seeded payment provider configs");

    const cbeCfg = cfgListJson.data.find((c: { providerCode: string }) => c.providerCode === "cbe");
    const cfgUpdateRes = await fetch(`${rootUrl}/admin/payment-providers/cbe`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        displayName: cbeCfg.displayName,
        receivingAccountName: cbeCfg.receivingAccountName,
        receivingAccountNumber: cbeCfg.receivingAccountNumber,
        accountSuffixDigits: cbeCfg.accountSuffixDigits,
        instructions: cbeCfg.instructions,
        isEnabled: true,
        maxPaymentAgeDays: 30,
      }),
    });
    assert(cfgUpdateRes.status === 200, "Admin PUT /payment-providers/cbe failed");
    console.info("✓ Scenario 14 passed: Admin inspection, reason enforcement, audit logs, Paid lock & config verified.");

    console.info("\n======================================================================");
    console.info("=== ALL 14 CHEKI PAYMENT VERIFICATION SCENARIOS PASSED (100%)      ===");
    console.info("======================================================================");
  } finally {
    chekiClient.getBanks = origGetBanks;
    chekiClient.getHealth = origGetHealth;
    chekiClient.verifyReceipt = origVerifyReceipt;
    clearRateLimitBuckets();

    // Clean up test records & restore variant inventory cleanly
    if (createdOrderIds.length > 0) {
      await prisma.paymentVerificationLog.deleteMany({
        where: { orderId: { in: createdOrderIds } },
      });
      await prisma.payment.deleteMany({
        where: { orderId: { in: createdOrderIds } },
      });
      await prisma.orderItem.deleteMany({
        where: { orderId: { in: createdOrderIds } },
      });
      await prisma.order.deleteMany({
        where: { id: { in: createdOrderIds } },
      });
    }
    if (stockRestoreOps.length > 0) {
      const grouped = new Map<string, number>();
      for (const op of stockRestoreOps) {
        grouped.set(op.variantId, (grouped.get(op.variantId) ?? 0) + op.incrementBy);
      }
      for (const [variantId, qty] of grouped.entries()) {
        await prisma.productVariant.update({
          where: { id: variantId },
          data: { stockQuantity: { increment: qty } },
        });
      }
    }
    if (createdUserIds.length > 0) {
      await prisma.refreshToken.deleteMany({
        where: { userId: { in: createdUserIds } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      });
    }

    // Restore original provider configurations so user settings stay untouched
    for (const cfg of savedConfigs) {
      await prisma.paymentProviderConfig.update({
        where: { providerCode: cfg.providerCode },
        data: {
          displayName: cfg.displayName,
          receivingAccountName: cfg.receivingAccountName,
          receivingAccountNumber: cfg.receivingAccountNumber,
          accountSuffixDigits: cfg.accountSuffixDigits,
          instructions: cfg.instructions,
          isEnabled: cfg.isEnabled,
          maxPaymentAgeDays: cfg.maxPaymentAgeDays,
        },
      });
    }

    server.close();
    await prisma.$disconnect();
  }
}

runChekiPaymentSuite().catch((err) => {
  console.error("Cheki Payment E2E Suite Failed:", err);
  process.exit(1);
});

