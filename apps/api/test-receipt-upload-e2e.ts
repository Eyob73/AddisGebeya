import sharp from "sharp";
import { createApp } from "./src/app.js";
import { prisma } from "./src/config/database.js";
import { clearRateLimitBuckets } from "./src/middlewares/rate-limit.middleware.js";
import { cloudinaryService } from "./src/modules/media/cloudinary.service.js";
import {
  chekiClient,
  type ChekiBankMetadata,
  type ChekiHealthBankItem,
  type ChekiVerifyOutcome,
  type ChekiVerifyRequest,
} from "./src/modules/payments/cheki.client.js";
import { ensurePaymentProviderConfigsSeeded } from "./src/modules/payments/payment-providers.seed.js";
import { shutdownOcrWorker } from "./src/modules/payments/receipt-ocr.service.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

function createValidJpegBuffer(): Buffer {
  return Buffer.from(
    "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDy6iiivQPBP//Z",
    "base64",
  );
}

function createValidPngBuffer(): Buffer {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAANSURBVBhXY2Bw9P8PAAJlAZAZIj5CAAAAAElFTkSuQmCC",
    "base64",
  );
}

function createValidWebpBuffer(): Buffer {
  return Buffer.from(
    "UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=",
    "base64",
  );
}

async function renderCbeReceiptPng(params: {
  reference: string;
  amountETB: number;
  dateStr: string;
  payer?: string;
  receiver?: string;
}): Promise<Buffer> {
  const formattedAmount = params.amountETB.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const svg = `<svg width="920" height="580" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#ffffff"/>
    <text x="40" y="75" font-size="30" font-family="Arial, sans-serif" font-weight="bold" fill="#000000">Commercial Bank of Ethiopia</text>
    <text x="40" y="130" font-size="24" font-family="Arial, sans-serif" fill="#111111">Status: Completed</text>
    <text x="40" y="185" font-size="26" font-family="Courier New, monospace" font-weight="bold" fill="#000000">Reference No: ${params.reference}</text>
    <text x="40" y="240" font-size="26" font-family="Arial, sans-serif" font-weight="bold" fill="#000000">Transferred Amount: ${formattedAmount} ETB</text>
    <text x="40" y="295" font-size="22" font-family="Arial, sans-serif" fill="#111111">Payment Date: ${params.dateStr}</text>
    <text x="40" y="350" font-size="22" font-family="Arial, sans-serif" fill="#111111">Payer: ${params.payer ?? "Abebe Bikila"}</text>
    <text x="40" y="405" font-size="22" font-family="Arial, sans-serif" fill="#111111">Receiver: ${params.receiver ?? "AddisGebeya Trading PLC"}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function runReceiptUploadE2E() {
  console.info("======================================================================");
  console.info("=== ADDISGEBEYA RECEIPT OCR + AUTO VERIFICATION E2E SUITE (10 CASES) ===");
  console.info("======================================================================");

  const app = createApp();
  const server = app.listen(5096);
  const v1Url = "http://localhost:5096/api/v1";

  const createdOrderIds: string[] = [];
  const createdUserIds: string[] = [];
  const uploadedReceiptPublicIds: string[] = [];
  const stockRestoreOps: Array<{ variantId: string; incrementBy: number }> = [];

  const origGetBanks = chekiClient.getBanks.bind(chekiClient);
  const origGetHealth = chekiClient.getHealth.bind(chekiClient);
  const origVerifyReceipt = chekiClient.verifyReceipt.bind(chekiClient);

  try {
    await ensurePaymentProviderConfigsSeeded();
    const cbeCfg = await prisma.paymentProviderConfig.findUnique({ where: { providerCode: "cbe" } });
    const telebirrCfg = await prisma.paymentProviderConfig.findUnique({ where: { providerCode: "telebirr" } });
    assert(cbeCfg && telebirrCfg, "Need CBE & Telebirr provider configs seeded");

    const variant = await prisma.productVariant.findFirst({
      where: { stockQuantity: { gte: 10 } },
      include: { product: true, colorway: true },
    });
    assert(variant, "Need a product variant with >= 10 stock in database");

    const ts = Date.now();
    const cbeRefSuccess = `FT2611CBE${String(ts).slice(-6)}`;
    const cbeRefMismatch = `FT2611MIS${String(ts).slice(-6)}`;
    const cbeRefOutage = `FT2611GYA${String(ts).slice(-6)}`;
    const cbeRefRetryRef = `FT2611RTY${String(ts).slice(-6)}`;
    const cbeRefConcurrent = `FT2611CNC${String(ts).slice(-6)}`;
    const telebirrRefOfficial = `DKG${String(ts).slice(-7)}`;
    const cbeRefTokenApi = `FT2611TKN${String(ts).slice(-6)}`;
    const cbeRefRejectedQr = `FT2611REJ${String(ts).slice(-6)}`;

    let simulateOutage = false;

    const mockBanks: ChekiBankMetadata[] = [
      {
        id: "cbe",
        name: "Commercial Bank of Ethiopia",
        type: "bank",
        status: "live",
        requiresAccount: false,
        accountDigits: 8,
        color: "#7C3AED",
        initials: "CBE",
        formats: [{ id: "ft", status: "live", label: "FT Reference", inputs: ["reference"], supported: true }],
      },
      {
        id: "telebirr",
        name: "Telebirr",
        type: "mobile",
        status: "live",
        color: "#006838",
        initials: "TB",
        formats: [{ id: "reference", status: "live", label: "Tx Ref", inputs: ["reference"], supported: true }],
      },
    ];
    const mockHealth: ChekiHealthBankItem[] = [
      { id: "cbe", name: "Commercial Bank of Ethiopia", status: "reachable", latencyMs: 30 },
      { id: "telebirr", name: "Telebirr", status: "reachable", latencyMs: 35 },
    ];

    let orderExpectedTotal = 0;

    chekiClient.getBanks = async () => mockBanks;
    chekiClient.getHealth = async () => mockHealth;
    chekiClient.verifyReceipt = async (req: ChekiVerifyRequest): Promise<ChekiVerifyOutcome> => {
      if (simulateOutage) {
        return { outcome: "unavailable", httpStatus: 503, error: "Cheki verification gateway offline" };
      }
      const ref = (req.reference || "").trim().toUpperCase();
      if (ref === telebirrRefOfficial.toUpperCase()) {
        return {
          outcome: "ok",
          data: {
            success: true,
            verified: true,
            bank: "Telebirr",
            bankCode: "telebirr",
            reference: ref,
            amount: orderExpectedTotal,
            currency: "ETB",
            senderName: "Telebirr Payer",
            senderAccount: "251911223344",
            receiverName: telebirrCfg.receivingAccountName,
            receiverAccount: telebirrCfg.receivingAccountNumber,
            date: new Date().toISOString(),
          },
        };
      }
      if (ref === cbeRefTokenApi.toUpperCase()) {
        return {
          outcome: "ok",
          data: {
            success: true,
            verified: true,
            bank: "Commercial Bank of Ethiopia",
            bankCode: "cbe",
            reference: ref,
            amount: orderExpectedTotal,
            currency: "ETB",
            senderName: "Token Payer",
            senderAccount: "1000****3344",
            receiverName: cbeCfg.receivingAccountName,
            receiverAccount: `1000****${cbeCfg.receivingAccountNumber.slice(-4)}`,
            date: new Date().toISOString(),
            sourceUrl: "https://mbreciept.cbe.com.et/v2-hfHCxHBTw7FA4RR1DP0b",
          },
        };
      }
      if (ref === cbeRefRejectedQr.toUpperCase()) {
        return {
          outcome: "rejected",
          httpStatus: 404,
          error: "CBE QR receipt not confirmed for order total",
        };
      }
      if (
        ref === cbeRefSuccess.toUpperCase() ||
        ref === cbeRefRetryRef.toUpperCase() ||
        ref === cbeRefConcurrent.toUpperCase()
      ) {
        return {
          outcome: "ok",
          data: {
            success: true,
            verified: true,
            bank: "Commercial Bank of Ethiopia",
            bankCode: "cbe",
            reference: ref,
            amount: orderExpectedTotal,
            currency: "ETB",
            senderName: "Abebe Bikila",
            senderAccount: "1000****1122",
            receiverName: cbeCfg.receivingAccountName,
            receiverAccount: `1000****${cbeCfg.receivingAccountNumber.slice(-4)}`,
            date: new Date().toISOString(),
            sourceUrl: `https://apps.cbe.com.et/?id=${ref}`,
          },
        };
      }
      if (ref === cbeRefMismatch.toUpperCase()) {
        return {
          outcome: "ok",
          data: {
            success: true,
            verified: true,
            bank: "Commercial Bank of Ethiopia",
            bankCode: "cbe",
            reference: ref,
            amount: Math.max(100, orderExpectedTotal - 450),
            currency: "ETB",
            senderName: "Short Payer",
            receiverName: cbeCfg.receivingAccountName,
            receiverAccount: `1000****${cbeCfg.receivingAccountNumber.slice(-4)}`,
            date: new Date().toISOString(),
          },
        };
      }
      return {
        outcome: "rejected",
        httpStatus: 404,
        error: "Transaction not found at bank portal",
      };
    };

    const regUser = async (name: string, email: string) => {
      const res = await fetch(`${v1Url}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone: "+251911223344",
          password: "TestPassword123!",
          preferredSize: variant.size,
          subCity: "Bole (Rwanda / Edna / Japan / Atlas)",
        }),
      });
      const json = await res.json();
      assert(res.status === 201 && json.data?.accessToken, `Register failed for ${email}`);
      createdUserIds.push(json.data.user.id);
      return {
        id: json.data.user.id as string,
        name,
        email,
        token: json.data.accessToken as string,
      };
    };

    const customer1 = await regUser("Receipt Owner", `receipt.c1.${ts}@example.com`);
    const customer2 = await regUser("Other Customer", `receipt.c2.${ts}@example.com`);

    const adminRes = await fetch(`${v1Url}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@addisgebeya.com",
        password: "AdminPass123!",
      }),
    });
    const adminJson = await adminRes.json();
    assert(adminRes.status === 200 && adminJson.data?.accessToken, "Admin login failed");
    const adminToken = adminJson.data.accessToken as string;

    const placeOrder = async (
      token: string,
      cust: { name: string; email: string },
      paymentMethod: string,
    ) => {
      const res = await fetch(`${v1Url}/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          customerName: cust.name,
          customerPhone: "+251911223344",
          customerEmail: cust.email,
          city: "Addis Ababa",
          subCity: "Bole (Rwanda / Edna / Japan / Atlas)",
          landmark: "Near Edna Mall",
          deliverySpeed: "standard",
          paymentMethod,
          items: [
            {
              productId: variant.productId,
              colorwayId: variant.colorwayId,
              productName: variant.product.name,
              sku: variant.product.sku,
              colorwayName: variant.colorway.name,
              size: variant.size,
              quantity: 1,
              unitPriceETB: Number(variant.product.priceETB),
              image: variant.colorway.images[0] || "",
            },
          ],
        }),
      });
      const json = await res.json();
      assert(res.status === 201 && json.data?.dbId, `Create order failed: ${JSON.stringify(json)}`);
      createdOrderIds.push(json.data.dbId);
      stockRestoreOps.push({ variantId: variant.id, incrementBy: 1 });
      return {
        dbId: json.data.dbId as string,
        orderNumber: json.data.id as string,
        totalETB: Number(json.data.totalETB),
      };
    };

    const order1 = await placeOrder(customer1.token, customer1, "cbe");
    const orderAuto = await placeOrder(customer1.token, customer1, "cbe");
    const orderMismatch = await placeOrder(customer1.token, customer1, "cbe");
    const orderDup = await placeOrder(customer2.token, customer2, "cbe");
    const orderOutage = await placeOrder(customer1.token, customer1, "cbe");
    const orderCod = await placeOrder(customer1.token, customer1, "cod");
    const orderWebp = await placeOrder(customer1.token, customer1, "telebirr");

    orderExpectedTotal = orderAuto.totalETB;

    // [Scenario 1] Auth & Cross-Customer Ownership Enforced
    console.info("\n[1] Auth & cross-customer ownership enforcement...");
    const noAuthForm = new FormData();
    noAuthForm.append("orderId", order1.orderNumber);
    noAuthForm.append("receipt", new Blob([createValidJpegBuffer()], { type: "image/jpeg" }), "r.jpg");
    const noAuthRes = await fetch(`${v1Url}/payment/receipts`, { method: "POST", body: noAuthForm });
    assert(noAuthRes.status === 401, `Expected 401 unauthenticated, got ${noAuthRes.status}`);

    const crossForm = new FormData();
    crossForm.append("orderId", order1.orderNumber);
    crossForm.append("receipt", new Blob([createValidJpegBuffer()], { type: "image/jpeg" }), "r.jpg");
    const crossRes = await fetch(`${v1Url}/payment/receipts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${customer2.token}` },
      body: crossForm,
    });
    assert(crossRes.status === 403, `Expected 403 cross-customer upload, got ${crossRes.status}`);
    console.info("✓ Scenario 1 passed.");

    // [Scenario 2] Validation & Malicious File Guards
    console.info("\n[2] File signature, spoofed MIME, size, and COD validation...");
    const spoofForm = new FormData();
    spoofForm.append("orderId", order1.orderNumber);
    spoofForm.append("receipt", new Blob([Buffer.from("<script>alert(1)</script>")], { type: "image/jpeg" }), "evil.jpg");
    const spoofRes = await fetch(`${v1Url}/payment/receipts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${customer1.token}` },
      body: spoofForm,
    });
    assert(spoofRes.status === 400, `Expected 400 for spoofed image, got ${spoofRes.status}`);

    const codForm = new FormData();
    codForm.append("orderId", orderCod.orderNumber);
    codForm.append("receipt", new Blob([createValidJpegBuffer()], { type: "image/jpeg" }), "cod.jpg");
    const codRes = await fetch(`${v1Url}/payment/receipts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${customer1.token}` },
      body: codForm,
    });
    assert(codRes.status === 400, `Expected 400 for COD upload, got ${codRes.status}`);
    console.info("✓ Scenario 2 passed.");

    // [Scenario 3] Real OCR Extraction Endpoint (POST /payment/receipts/extract)
    console.info("\n[3] OCR & metadata extraction endpoint on rendered CBE receipt...");
    const renderedValidPng = await renderCbeReceiptPng({
      reference: cbeRefSuccess,
      amountETB: orderAuto.totalETB,
      dateStr: "2026-11-25 14:30",
      receiver: cbeCfg.receivingAccountName,
    });

    const extractForm = new FormData();
    extractForm.append("orderId", orderAuto.orderNumber);
    extractForm.append("provider", "cbe");
    extractForm.append("receipt", new Blob([renderedValidPng], { type: "image/png" }), "cbe-slip.png");
    const extractRes = await fetch(`${v1Url}/payment/receipts/extract`, {
      method: "POST",
      headers: { Authorization: `Bearer ${customer1.token}` },
      body: extractForm,
    });
    const extractJson = await extractRes.json();
    assert(extractRes.status === 200 && extractJson.data, `Extract failed: ${JSON.stringify(extractJson)}`);
    assert(
      extractJson.data.extractedReference === cbeRefSuccess,
      `Expected OCR ref ${cbeRefSuccess}, got ${extractJson.data.extractedReference}`,
    );
    assert(
      extractJson.data.detectedProvider === "cbe",
      `Expected detectedProvider=cbe, got ${extractJson.data.detectedProvider}`,
    );
    assert(
      Math.round((extractJson.data.extractedAmountETB ?? 0) * 100) === Math.round(orderAuto.totalETB * 100),
      `Expected OCR amount ${orderAuto.totalETB}, got ${extractJson.data.extractedAmountETB}`,
    );

    // Unreadable 1x1 blank receipt should report extractionSucceeded: false
    const blankExtractForm = new FormData();
    blankExtractForm.append("orderId", orderAuto.orderNumber);
    blankExtractForm.append("receipt", new Blob([createValidJpegBuffer()], { type: "image/jpeg" }), "blank.jpg");
    const blankExtractRes = await fetch(`${v1Url}/payment/receipts/extract`, {
      method: "POST",
      headers: { Authorization: `Bearer ${customer1.token}` },
      body: blankExtractForm,
    });
    const blankExtractJson = await blankExtractRes.json();
    assert(
      blankExtractRes.status === 200 && blankExtractJson.data?.extractionSucceeded === false,
      `Expected extractionSucceeded=false for blank image, got ${JSON.stringify(blankExtractJson)}`,
    );
    console.info("✓ Scenario 3 passed: OCR extracted ref/amount/provider accurately & flagged blank image.");

    // [Scenario 4] Automatic Receipt Verification via OCR + Cheki Provider API -> Verified + Paid + Confirmed
    console.info("\n[4] Auto OCR + Cheki API Verification -> Verified / Paid / Confirmed...");
    const autoForm = new FormData();
    autoForm.append("orderId", orderAuto.orderNumber);
    autoForm.append("provider", "cbe");
    autoForm.append("captureMethod", "upload");
    autoForm.append("receipt", new Blob([renderedValidPng], { type: "image/png" }), "cbe-auto.png");
    const autoRes = await fetch(`${v1Url}/payment/receipts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${customer1.token}` },
      body: autoForm,
    });
    const autoJson = await autoRes.json();
    assert(
      autoRes.status === 201 &&
        autoJson.data?.verified === true &&
        autoJson.data?.verificationStatus === "Verified" &&
        autoJson.data?.verificationSource === "provider_api" &&
        autoJson.data?.paymentStatus === "Paid" &&
        autoJson.data?.orderStatus === "Confirmed",
      `Expected automatic Verified outcome, got ${JSON.stringify(autoJson)}`,
    );
    const dbAutoReceipt = await prisma.paymentReceipt.findUnique({ where: { id: autoJson.data.receipt.id } });
    assert(dbAutoReceipt?.normalizedVerifiedReference, "Expected normalizedVerifiedReference stored");
    if (dbAutoReceipt?.publicId) uploadedReceiptPublicIds.push(dbAutoReceipt.publicId);
    console.info("✓ Scenario 4 passed: Receipt verified automatically via OCR + Cheki API.");

    // [Scenario 5] Duplicate Transaction Reference Across Orders -> 409 CONFLICT
    console.info("\n[5] Duplicate normalized reference prevention across orders (409)...");
    const dupOrderForm = new FormData();
    dupOrderForm.append("orderId", orderDup.orderNumber);
    dupOrderForm.append("provider", "cbe");
    dupOrderForm.append("transactionReference", cbeRefSuccess.toLowerCase()); // different casing
    dupOrderForm.append("receipt", new Blob([renderedValidPng], { type: "image/png" }), "dup-slip.png");
    const dupOrderRes = await fetch(`${v1Url}/payment/receipts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${customer2.token}` },
      body: dupOrderForm,
    });
    const dupOrderJson = await dupOrderRes.json();
    assert(
      dupOrderRes.status === 409 && dupOrderJson.code === "DUPLICATE_TRANSACTION_REFERENCE",
      `Expected 409 DUPLICATE_TRANSACTION_REFERENCE, got ${dupOrderRes.status} ${JSON.stringify(dupOrderJson)}`,
    );
    const dupSavedReceipts = await prisma.paymentReceipt.findMany({ where: { orderId: orderDup.dbId } });
    for (const r of dupSavedReceipts) {
      if (r.publicId) uploadedReceiptPublicIds.push(r.publicId);
      assert(r.status === "Rejected", `Expected duplicate attempt receipt status=Rejected, got ${r.status}`);
    }
    console.info("✓ Scenario 5 passed: Duplicate normalized reference rejected cleanly with 409.");

    // [Scenario 6] Amount Mismatch From Provider API -> Rejected With Clear Reason & Resubmission Allowed
    console.info("\n[6] Amount mismatch from provider API -> Rejected status...");
    const mismatchPng = await renderCbeReceiptPng({
      reference: cbeRefMismatch,
      amountETB: orderMismatch.totalETB, // fake OCR image claiming full total while bank returns -450 ETB
      dateStr: "2026-11-25 14:35",
    });
    const mismatchForm = new FormData();
    mismatchForm.append("orderId", orderMismatch.orderNumber);
    mismatchForm.append("provider", "cbe");
    mismatchForm.append("receipt", new Blob([mismatchPng], { type: "image/png" }), "mismatch.png");
    const mismatchRes = await fetch(`${v1Url}/payment/receipts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${customer1.token}` },
      body: mismatchForm,
    });
    const mismatchJson = await mismatchRes.json();
    assert(
      mismatchRes.status === 201 &&
        mismatchJson.data?.verified === false &&
        mismatchJson.data?.verificationStatus === "Rejected" &&
        mismatchJson.data?.receipt?.resubmissionRequested === true,
      `Expected Rejected receipt on amount mismatch, got ${JSON.stringify(mismatchJson)}`,
    );
    if (mismatchJson.data?.receipt?.id) {
      const dbMis = await prisma.paymentReceipt.findUnique({ where: { id: mismatchJson.data.receipt.id } });
      if (dbMis?.publicId) uploadedReceiptPublicIds.push(dbMis.publicId);
    }
    console.info("✓ Scenario 6 passed: Never trusted OCR amount alone; bank mismatch triggered Rejected.");

    // [Scenario 7] Cheki API Outage -> Manual Review -> Retry POST /receipts/:id/verify -> Verified
    console.info("\n[7] Provider API outage -> Manual Review -> retry verification -> Verified...");
    simulateOutage = true;
    const outageForm = new FormData();
    outageForm.append("orderId", orderOutage.orderNumber);
    outageForm.append("provider", "cbe");
    outageForm.append("transactionReference", cbeRefOutage);
    outageForm.append("receipt", new Blob([createValidPngBuffer()], { type: "image/png" }), "outage.png");
    const outageRes = await fetch(`${v1Url}/payment/receipts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${customer1.token}` },
      body: outageForm,
    });
    const outageJson = await outageRes.json();
    assert(
      outageRes.status === 201 && outageJson.data?.verificationStatus === "Manual Review",
      `Expected Manual Review on 503 outage, got ${JSON.stringify(outageJson)}`,
    );
    const outageReceiptId = outageJson.data.receipt.id as string;
    const dbOut = await prisma.paymentReceipt.findUnique({ where: { id: outageReceiptId } });
    if (dbOut?.publicId) uploadedReceiptPublicIds.push(dbOut.publicId);

    // Verify admin filter shows ManualReview
    const manualQueueRes = await fetch(
      `${v1Url}/admin/payments?status=ManualReview&search=${orderOutage.orderNumber}`,
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );
    const manualQueueJson = await manualQueueRes.json();
    assert(
      manualQueueRes.status === 200 && manualQueueJson.data?.items?.length === 1,
      `Expected orderOutage in ManualReview filter, got ${JSON.stringify(manualQueueJson)}`,
    );

    // Cheki recovers; customer retries with corrected reference
    simulateOutage = false;
    const retryRes = await fetch(`${v1Url}/payment/receipts/${outageReceiptId}/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customer1.token}`,
      },
      body: JSON.stringify({ provider: "cbe", transactionReference: cbeRefRetryRef }),
    });
    const retryJson = await retryRes.json();
    assert(
      retryRes.status === 200 &&
        retryJson.data?.verified === true &&
        retryJson.data?.verificationStatus === "Verified" &&
        retryJson.data?.verificationSource === "provider_api",
      `Expected Verified on retry, got ${JSON.stringify(retryJson)}`,
    );
    console.info("✓ Scenario 7 passed: Cheki outage fell back to Manual Review and recovered via /verify.");

    // [Scenario 8] Legacy Pending Workflow (`autoVerify=false`), Protected Cloudinary RBAC, Request New Receipt & Audited Admin Manual Approval (`admin_manual`)
    console.info("\n[8] Pending upload (autoVerify=false), Cloudinary RBAC, replacement camera capture, & audited admin_manual approval...");
    const pendingForm = new FormData();
    pendingForm.append("orderId", order1.orderNumber);
    pendingForm.append("provider", "cbe");
    pendingForm.append("captureMethod", "upload");
    pendingForm.append("autoVerify", "false");
    pendingForm.append("transactionReference", `FT2611UP_${ts}`);
    pendingForm.append("receipt", new Blob([createValidJpegBuffer()], { type: "image/jpeg" }), "cbe-pending.jpg");
    const upRes = await fetch(`${v1Url}/payment/receipts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${customer1.token}` },
      body: pendingForm,
    });
    const upJson = await upRes.json();
    assert(upRes.status === 201 && upJson.data?.receipt?.status === "Pending", `Expected Pending status`);
    const receipt1 = upJson.data.receipt;
    const dbR1 = await prisma.paymentReceipt.findUnique({ where: { id: receipt1.id } });
    if (dbR1?.publicId) uploadedReceiptPublicIds.push(dbR1.publicId);

    // Unsigned CDN check & file RBAC
    const unsignedUrl = receipt1.imageUrl.replace(/\/s--[^/]+--\//, "/");
    const unsignedRes = await fetch(unsignedUrl);
    assert(!unsignedRes.ok, "Expected unsigned Cloudinary authenticated URL to fail");

    const ownerFileRes = await fetch(`${v1Url}${receipt1.fileUrl}`, {
      headers: { Authorization: `Bearer ${customer1.token}` },
    });
    assert(ownerFileRes.status === 200, "Owner file fetch failed");
    const otherFileRes = await fetch(`${v1Url}${receipt1.fileUrl}`, {
      headers: { Authorization: `Bearer ${customer2.token}` },
    });
    assert(otherFileRes.status === 403, "Expected 403 for other customer file access");

    // Duplicate upload while Pending -> 409 RECEIPT_ALREADY_PENDING
    const dupPendForm = new FormData();
    dupPendForm.append("orderId", order1.orderNumber);
    dupPendForm.append("receipt", new Blob([createValidPngBuffer()], { type: "image/png" }), "dup.png");
    const dupPendRes = await fetch(`${v1Url}/payment/receipts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${customer1.token}` },
      body: dupPendForm,
    });
    assert(dupPendRes.status === 409, "Expected 409 RECEIPT_ALREADY_PENDING");

    // Customer tamper blocked (403)
    const custTamperRes = await fetch(`${v1Url}/admin/payments/${receipt1.paymentId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${customer1.token}` },
      body: JSON.stringify({ decision: "approve", reason: "Customer self approve" }),
    });
    assert(custTamperRes.status === 403, "Expected 403 customer tamper blocked");

    // Admin requests new receipt -> customer uploads camera PNG -> admin approves manually (admin_manual)
    const reqNewRes = await fetch(`${v1Url}/admin/payments/${receipt1.paymentId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ decision: "request_new_receipt", reason: "Image is cropped; please recapture." }),
    });
    const reqNewJson = await reqNewRes.json();
    assert(reqNewRes.status === 200 && reqNewJson.data?.latestReceipt?.status === "Rejected", "Expected Rejected");

    const replaceForm = new FormData();
    replaceForm.append("orderId", order1.orderNumber);
    replaceForm.append("provider", "cbe");
    replaceForm.append("captureMethod", "camera");
    replaceForm.append("receipt", new Blob([createValidPngBuffer()], { type: "image/png" }), "cam.png");
    const replaceRes = await fetch(`${v1Url}/payment/receipts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${customer1.token}` },
      body: replaceForm,
    });
    const replaceJson = await replaceRes.json();
    assert(
      replaceRes.status === 201 && replaceJson.data?.verificationStatus === "Manual Review",
      `Expected Manual Review on unreadable camera PNG replacement, got ${JSON.stringify(replaceJson)}`,
    );
    const dbR2 = await prisma.paymentReceipt.findUnique({ where: { id: replaceJson.data.receipt.id } });
    if (dbR2?.publicId) uploadedReceiptPublicIds.push(dbR2.publicId);

    const approveRes = await fetch(`${v1Url}/admin/payments/${receipt1.paymentId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ decision: "approve", reason: "Manually verified against Bole branch bank statement." }),
    });
    const approveJson = await approveRes.json();
    assert(
      approveRes.status === 200 &&
        approveJson.data?.paymentStatus === "Paid" &&
        approveJson.data?.orderStatus === "Confirmed" &&
        approveJson.data?.verificationSource === "admin_manual" &&
        approveJson.data?.latestReceipt?.status === "Verified" &&
        approveJson.data?.latestReceipt?.verificationSource === "admin_manual",
      `Expected audited admin_manual Verified status, got ${JSON.stringify(approveJson)}`,
    );
    console.info("✓ Scenario 8 passed: Cloudinary RBAC, Manual Review replacement & audited admin_manual approval verified.");

    // [Scenario 9] WebP Upload + Unreadable Fallback -> Manual Review & Receipt History
    console.info("\n[9] WebP upload & order receipt history check...");
    const webpForm = new FormData();
    webpForm.append("orderId", orderWebp.orderNumber);
    webpForm.append("provider", "telebirr");
    webpForm.append("captureMethod", "upload");
    webpForm.append("receipt", new Blob([createValidWebpBuffer()], { type: "image/webp" }), "telebirr.webp");
    const webpRes = await fetch(`${v1Url}/payment/receipts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${customer1.token}` },
      body: webpForm,
    });
    const webpJson = await webpRes.json();
    assert(
      webpRes.status === 201 &&
        webpJson.data?.receipt?.mimeType === "image/webp" &&
        webpJson.data?.verificationStatus === "Manual Review",
      `WebP fallback check failed: ${JSON.stringify(webpJson)}`,
    );
    const dbWebp = await prisma.paymentReceipt.findUnique({ where: { id: webpJson.data.receipt.id } });
    if (dbWebp?.publicId) uploadedReceiptPublicIds.push(dbWebp.publicId);

    const histRes = await fetch(`${v1Url}/payment/receipts/order/${order1.orderNumber}`, {
      headers: { Authorization: `Bearer ${customer1.token}` },
    });
    const histJson = await histRes.json();
    assert(histRes.status === 200 && histJson.data?.receipts?.length === 2, "Expected 2 receipts on order1");
    console.info("✓ Scenario 9 passed.");

    // [Scenario 10] Concurrent Duplicate Verification Race Condition Across 2 Orders
    console.info("\n[10] Concurrent duplicate verification lock (Promise.all across 2 orders)...");
    const orderConc1 = await placeOrder(customer1.token, customer1, "cbe");
    const orderConc2 = await placeOrder(customer2.token, customer2, "cbe");
    const concurrentPng = await renderCbeReceiptPng({
      reference: cbeRefConcurrent,
      amountETB: orderConc1.totalETB,
      dateStr: "2026-11-25 14:40",
    });

    const sendConc = (token: string, orderNum: string) => {
      const fd = new FormData();
      fd.append("orderId", orderNum);
      fd.append("provider", "cbe");
      fd.append("receipt", new Blob([concurrentPng], { type: "image/png" }), "conc.png");
      return fetch(`${v1Url}/payment/receipts`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
    };

    const [concRes1, concRes2] = await Promise.all([
      sendConc(customer1.token, orderConc1.orderNumber),
      sendConc(customer2.token, orderConc2.orderNumber),
    ]);
    const concJson1 = await concRes1.json();
    const concJson2 = await concRes2.json();

    const concReceipts = await prisma.paymentReceipt.findMany({
      where: { orderId: { in: [orderConc1.dbId, orderConc2.dbId] } },
    });
    for (const r of concReceipts) {
      if (r.publicId) uploadedReceiptPublicIds.push(r.publicId);
    }

    const statuses = [concRes1.status, concRes2.status].sort((a, b) => a - b);
    assert(
      statuses[0] === 201 && statuses[1] === 409,
      `Expected one 201 Verified and one 409 DUPLICATE_TRANSACTION_REFERENCE, got ${concRes1.status} (${JSON.stringify(concJson1)}) vs ${concRes2.status} (${JSON.stringify(concJson2)})`,
    );
    console.info("✓ Scenario 10 passed: Strictly one concurrent transaction confirmed; second blocked with 409.");

    // [Scenario 11] Persistent Receipt Access & Time-Limited Signed Access Links Across All Statuses
    console.info("\n[11] Persistent receipt access & signed ?access= URLs across Verified, Rejected, & Manual Review...");
    const assertAdminCanOpenReceipt = async (receiptId: string, label: string, expectedMimePrefix: string) => {
      const accessRes = await fetch(`${v1Url}/payment/receipts/${receiptId}/access`, {
        method: "POST",
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const accessJson = await accessRes.json();
      assert(
        accessRes.status === 200 && typeof accessJson.data?.accessUrl === "string" && accessJson.data.accessUrl.includes("?access="),
        `Expected signed accessUrl for ${label}, got ${accessRes.status} ${JSON.stringify(accessJson)}`,
      );
      const streamRes = await fetch(`${v1Url}${accessJson.data.accessUrl}`);
      const ctype = streamRes.headers.get("content-type") ?? "";
      assert(
        streamRes.status === 200 && ctype.toLowerCase().startsWith(expectedMimePrefix),
        `Expected 200 ${expectedMimePrefix} streaming for ${label}, got ${streamRes.status} (${ctype})`,
      );
      return accessJson.data.accessUrl as string;
    };

    // Admin opens Verified receipt (orderAuto), Rejected receipt (orderMismatch), AND BOTH historical receipts on order1!
    await assertAdminCanOpenReceipt(dbAutoReceipt!.id, "Verified receipt", "image/png");
    const mismatchReceipt = (await prisma.paymentReceipt.findFirst({ where: { orderId: orderMismatch.dbId } }))!;
    await assertAdminCanOpenReceipt(mismatchReceipt.id, "Rejected receipt", "image/png");
    await assertAdminCanOpenReceipt(dbWebp!.id, "Manual Review receipt", "image/webp");
    const signedOrder1R1 = await assertAdminCanOpenReceipt(dbR1!.id, "Order1 Original Rejected receipt", "image/jpeg");
    await assertAdminCanOpenReceipt(dbR2!.id, "Order1 Approved Replacement receipt", "image/png");

    // Admin queue for order1 must preserve BOTH original rejected receipt AND final verified receipt
    const order1QueueRes = await fetch(
      `${v1Url}/admin/payments?search=${order1.orderNumber}`,
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );
    const order1QueueJson = await order1QueueRes.json();
    assert(
      order1QueueRes.status === 200 && order1QueueJson.data?.items?.[0]?.receipts?.length === 2,
      `Expected admin queue to preserve both receipts for order1, got ${JSON.stringify(order1QueueJson)}`,
    );

    // Security: cross-customer blocked on /access (403), unauthenticated blocked (401), token bound to single receiptId
    const crossAccessRes = await fetch(`${v1Url}/payment/receipts/${dbAutoReceipt!.id}/access`, {
      method: "POST",
      headers: { Authorization: `Bearer ${customer2.token}` },
    });
    assert(crossAccessRes.status === 403, `Expected 403 cross-customer access link request, got ${crossAccessRes.status}`);

    const wrongReceiptWithToken = signedOrder1R1.replace(dbR1!.id, dbAutoReceipt!.id);
    const mismatchTokenRes = await fetch(`${v1Url}${wrongReceiptWithToken}`);
    assert(mismatchTokenRes.status === 403, `Expected 403 when using receipt token on another receipt, got ${mismatchTokenRes.status}`);

    const unauthStreamRes = await fetch(`${v1Url}/payment/receipts/${dbAutoReceipt!.id}/file?access=invalid.token.value`);
    assert(unauthStreamRes.status === 401, `Expected 401 for tampered access token, got ${unauthStreamRes.status}`);
    console.info("✓ Scenario 11 passed: Receipts remain permanently accessible across all statuses with strict scoped links.");

    // [Scenario 12] PDF Receipt Upload + Signed Inline PDF Streaming
    console.info("\n[12] PDF payment receipt upload, OCR fallback & inline PDF browser viewer streaming...");
    const orderPdf = await placeOrder(customer1.token, customer1, "telebirr");
    const samplePdfBytes = Buffer.from(
      `%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n3 0 obj << /Type /Page /Parent 2 0 R /Contents 4 0 R >> endobj\n4 0 obj << /Length 44 >> stream\nBT (Telebirr Reference: TB9988PDF) ET\nendstream endobj\nxref\n0 5\n0000000000 65535 f \ntrailer << /Root 1 0 R /Size 5 >>\nstartxref\n0\n%%EOF\n`,
      "utf-8",
    );
    const pdfForm = new FormData();
    pdfForm.append("orderId", orderPdf.orderNumber);
    pdfForm.append("provider", "telebirr");
    pdfForm.append("captureMethod", "upload");
    pdfForm.append("receipt", new Blob([samplePdfBytes], { type: "application/pdf" }), "telebirr-receipt.pdf");

    const pdfUpRes = await fetch(`${v1Url}/payment/receipts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${customer1.token}` },
      body: pdfForm,
    });
    const pdfUpJson = await pdfUpRes.json();
    assert(
      pdfUpRes.status === 201 && pdfUpJson.data?.receipt?.mimeType === "application/pdf",
      `Expected 201 PDF receipt upload, got ${pdfUpRes.status} ${JSON.stringify(pdfUpJson)}`,
    );
    const dbPdf = await prisma.paymentReceipt.findUnique({ where: { id: pdfUpJson.data.receipt.id } });
    if (dbPdf?.publicId) uploadedReceiptPublicIds.push(dbPdf.publicId);

    const signedPdfUrl = await assertAdminCanOpenReceipt(dbPdf!.id, "PDF receipt", "application/pdf");
    const pdfStreamRes = await fetch(`${v1Url}${signedPdfUrl}`);
    const pdfDisp = pdfStreamRes.headers.get("content-disposition") ?? "";
    const pdfDownloaded = Buffer.from(await pdfStreamRes.arrayBuffer());
    assert(
      pdfDisp.includes("inline") && pdfDisp.includes(".pdf") && pdfDownloaded.subarray(0, 5).toString("ascii") === "%PDF-",
      `Expected inline PDF bytes, got disp=${pdfDisp}`,
    );
    console.info("✓ Scenario 12 passed: PDF receipt stored safely & streamed with inline application/pdf.");

    // [Scenario 13] Official Telebirr & CBE Receipt URLs, Token Handling & Hostname Validation
    console.info("\n[13] Official Telebirr/CBE receipt links, FT refusal, status persistence & host security...");
    clearRateLimitBuckets();

    // 13a. Telebirr verifies & builds https://transactioninfo.ethiotelecom.et/receipt/{REF} while keeping uploaded image accessible
    const orderTbOfficial = await placeOrder(customer1.token, customer1, "telebirr");
    orderExpectedTotal = orderTbOfficial.totalETB;
    const tbForm = new FormData();
    tbForm.append("orderId", orderTbOfficial.orderNumber);
    tbForm.append("provider", "telebirr");
    tbForm.append("transactionReference", telebirrRefOfficial);
    tbForm.append("phoneNumber", "+251911223344");
    tbForm.append("captureMethod", "upload");
    tbForm.append("autoVerify", "true");
    tbForm.append("receipt", new Blob([createValidPngBuffer()], { type: "image/png" }), "telebirr-ok.png");

    const tbRes = await fetch(`${v1Url}/payment/receipts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${customer1.token}` },
      body: tbForm,
    });
    const tbJson = await tbRes.json();
    const expectedTbOfficialUrl = `https://transactioninfo.ethiotelecom.et/receipt/${telebirrRefOfficial}`;
    assert(
      tbRes.status === 201 &&
        tbJson.data?.verified === true &&
        tbJson.data?.officialReceiptUrl === expectedTbOfficialUrl &&
        tbJson.data?.receipt?.officialReceiptUrl === expectedTbOfficialUrl,
      `Expected Telebirr officialReceiptUrl=${expectedTbOfficialUrl}, got ${tbRes.status} ${JSON.stringify(tbJson)}`,
    );
    const dbTbReceipt = await prisma.paymentReceipt.findUnique({ where: { id: tbJson.data.receipt.id } });
    if (dbTbReceipt?.publicId) uploadedReceiptPublicIds.push(dbTbReceipt.publicId);

    const tbAdminQueueRes = await fetch(`${v1Url}/admin/payments?search=${orderTbOfficial.orderNumber}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const tbAdminQueueJson = await tbAdminQueueRes.json();
    assert(
      tbAdminQueueRes.status === 200 &&
        tbAdminQueueJson.data?.items?.[0]?.officialReceiptUrl === expectedTbOfficialUrl,
      `Expected Telebirr official URL in admin queue, got ${JSON.stringify(tbAdminQueueJson)}`,
    );

    const adminOrdersRes = await fetch(`${v1Url}/orders`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminOrdersJson = await adminOrdersRes.json();
    const tbOrderRow = (adminOrdersJson.data ?? []).find(
      (o: { id: string }) => o.id === orderTbOfficial.orderNumber,
    );
    assert(
      adminOrdersRes.status === 200 &&
        tbOrderRow?.officialReceiptUrl === expectedTbOfficialUrl &&
        tbOrderRow?.latestReceiptId === tbJson.data.receipt.id,
      `Expected Telebirr official URL on /orders record, got ${JSON.stringify(tbOrderRow)}`,
    );
    await assertAdminCanOpenReceipt(tbJson.data.receipt.id, "Telebirr uploaded PNG", "image/png");

    // 13b. CBE bare FT... must NEVER fabricate a receipt token; real token via admin review or Cheki sourceUrl works
    const orderCbeNoToken = await placeOrder(customer1.token, customer1, "cbe");
    const cbeBareRef = `FT2611BARE${String(ts).slice(-5)}`;
    const cbeBareForm = new FormData();
    cbeBareForm.append("orderId", orderCbeNoToken.orderNumber);
    cbeBareForm.append("provider", "cbe");
    cbeBareForm.append("transactionReference", cbeBareRef);
    cbeBareForm.append("cbeReceiptToken", cbeBareRef);
    cbeBareForm.append("captureMethod", "upload");
    cbeBareForm.append("autoVerify", "false");
    cbeBareForm.append("receipt", new Blob([createValidPngBuffer()], { type: "image/png" }), "cbe-notoken.png");

    const cbeBareRes = await fetch(`${v1Url}/payment/receipts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${customer1.token}` },
      body: cbeBareForm,
    });
    const cbeBareJson = await cbeBareRes.json();
    assert(
      cbeBareRes.status === 201 &&
        cbeBareJson.data?.receipt?.officialReceiptUrl === null &&
        cbeBareJson.data?.receipt?.cbeReceiptToken === null &&
        typeof cbeBareJson.data?.receipt?.officialReceiptReason === "string",
      `Expected bare FT CBE submission to refuse token construction, got ${JSON.stringify(cbeBareJson)}`,
    );
    const dbCbeBareReceipt = await prisma.paymentReceipt.findUnique({ where: { id: cbeBareJson.data.receipt.id } });
    if (dbCbeBareReceipt?.publicId) uploadedReceiptPublicIds.push(dbCbeBareReceipt.publicId);

    const approveBareRes = await fetch(`${v1Url}/admin/payments/${dbCbeBareReceipt!.paymentId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        decision: "approve",
        reason: "Verified on CBE statement without tokenized link.",
        reference: cbeBareRef,
      }),
    });
    const approveBareJson = await approveBareRes.json();
    assert(
      approveBareRes.status === 200 &&
        approveBareJson.data?.officialReceiptUrl === null &&
        approveBareJson.data?.cbeReceiptToken === null,
      `Expected manual CBE approval without token to keep officialReceiptUrl=null, got ${JSON.stringify(approveBareJson)}`,
    );

    // Admin manual approval WITH authentic CBE token saves real https://mbreciept.cbe.com.et/{TOKEN}
    const orderCbeManualToken = await placeOrder(customer1.token, customer1, "cbe");
    const cbeManRef = `FT2611MANTK${String(ts).slice(-5)}`;
    const cbeManForm = new FormData();
    cbeManForm.append("orderId", orderCbeManualToken.orderNumber);
    cbeManForm.append("provider", "cbe");
    cbeManForm.append("transactionReference", cbeManRef);
    cbeManForm.append("captureMethod", "upload");
    cbeManForm.append("autoVerify", "false");
    cbeManForm.append("receipt", new Blob([createValidPngBuffer()], { type: "image/png" }), "cbe-manualtoken.png");
    const cbeManRes = await fetch(`${v1Url}/payment/receipts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${customer1.token}` },
      body: cbeManForm,
    });
    const cbeManJson = await cbeManRes.json();
    assert(cbeManRes.status === 201, `CBE manual upload failed: ${JSON.stringify(cbeManJson)}`);
    const dbCbeManReceipt = await prisma.paymentReceipt.findUnique({ where: { id: cbeManJson.data.receipt.id } });
    if (dbCbeManReceipt?.publicId) uploadedReceiptPublicIds.push(dbCbeManReceipt.publicId);

    const realCbeToken = "v2-hfHCxHBTw7FA4RR1DP0b";
    const expectedCbeOfficialUrl = `https://mbreciept.cbe.com.et/${realCbeToken}`;
    const approveTokRes = await fetch(`${v1Url}/admin/payments/${dbCbeManReceipt!.paymentId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        decision: "approve",
        reason: "Verified via official CBE token.",
        reference: cbeManRef,
        cbeReceiptToken: realCbeToken,
      }),
    });
    const approveTokJson = await approveTokRes.json();
    assert(
      approveTokRes.status === 200 &&
        approveTokJson.data?.officialReceiptUrl === expectedCbeOfficialUrl &&
        approveTokJson.data?.cbeReceiptToken === realCbeToken,
      `Expected official CBE URL with real token, got ${JSON.stringify(approveTokJson)}`,
    );
    await assertAdminCanOpenReceipt(dbCbeManReceipt!.id, "CBE Manual Token uploaded PNG", "image/png");

    // Cheki provider API sourceUrl with real CBE token is persisted across direct /payment/verify
    const orderCbeApiToken = await placeOrder(customer1.token, customer1, "cbe");
    orderExpectedTotal = orderCbeApiToken.totalETB;
    const cbeApiVerifyRes = await fetch(`${v1Url}/payment/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${customer1.token}` },
      body: JSON.stringify({
        orderId: orderCbeApiToken.orderNumber,
        provider: "cbe",
        reference: cbeRefTokenApi,
      }),
    });
    const cbeApiVerifyJson = await cbeApiVerifyRes.json();
    assert(
      cbeApiVerifyRes.status === 200 &&
        cbeApiVerifyJson.data?.officialReceiptUrl === expectedCbeOfficialUrl &&
        cbeApiVerifyJson.data?.cbeReceiptToken === realCbeToken,
      `Expected Cheki sourceUrl CBE official URL on /payment/verify, got ${JSON.stringify(cbeApiVerifyJson)}`,
    );

    // 13c. Rejected payment preserves QR/token official link AND original uploaded image
    clearRateLimitBuckets();
    const orderCbeRejQr = await placeOrder(customer1.token, customer1, "cbe");
    const cbeRejForm = new FormData();
    cbeRejForm.append("orderId", orderCbeRejQr.orderNumber);
    cbeRejForm.append("provider", "cbe");
    cbeRejForm.append("transactionReference", cbeRefRejectedQr);
    cbeRejForm.append("qrData", "https://mbreciept.cbe.com.et/v2-QrRejected000123");
    cbeRejForm.append("captureMethod", "upload");
    cbeRejForm.append("autoVerify", "true");
    cbeRejForm.append("receipt", new Blob([createValidJpegBuffer()], { type: "image/jpeg" }), "cbe-rejected-qr.jpg");
    const cbeRejRes = await fetch(`${v1Url}/payment/receipts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${customer1.token}` },
      body: cbeRejForm,
    });
    const cbeRejJson = await cbeRejRes.json();
    assert(
      cbeRejRes.status === 201 &&
        cbeRejJson.data?.receipt?.status === "Rejected" &&
        cbeRejJson.data?.receipt?.officialReceiptUrl === "https://mbreciept.cbe.com.et/v2-QrRejected000123" &&
        cbeRejJson.data?.receipt?.cbeReceiptToken === "v2-QrRejected000123",
      `Expected Rejected receipt to retain scanned CBE QR official URL, got ${JSON.stringify(cbeRejJson)}`,
    );
    const dbCbeRejReceipt = await prisma.paymentReceipt.findUnique({ where: { id: cbeRejJson.data.receipt.id } });
    if (dbCbeRejReceipt?.publicId) uploadedReceiptPublicIds.push(dbCbeRejReceipt.publicId);
    await assertAdminCanOpenReceipt(dbCbeRejReceipt!.id, "CBE Rejected QR JPEG", "image/jpeg");

    // 13d. Security: reject arbitrary or wrong-provider hostnames in officialReceiptUrl (400 INVALID_OFFICIAL_RECEIPT_URL)
    const orderSec = await placeOrder(customer1.token, customer1, "cbe");
    const secUploadForm = new FormData();
    secUploadForm.append("orderId", orderSec.orderNumber);
    secUploadForm.append("provider", "cbe");
    secUploadForm.append("officialReceiptUrl", "https://evil.example/steal");
    secUploadForm.append("captureMethod", "upload");
    secUploadForm.append("autoVerify", "false");
    secUploadForm.append("receipt", new Blob([createValidPngBuffer()], { type: "image/png" }), "evil.png");
    const secUploadRes = await fetch(`${v1Url}/payment/receipts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${customer1.token}` },
      body: secUploadForm,
    });
    const secUploadJson = await secUploadRes.json();
    assert(
      secUploadRes.status === 400 && secUploadJson.code === "INVALID_OFFICIAL_RECEIPT_URL",
      `Expected 400 INVALID_OFFICIAL_RECEIPT_URL on upload, got ${secUploadRes.status} ${JSON.stringify(secUploadJson)}`,
    );

    const secCrossHostRes = await fetch(`${v1Url}/payment/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${customer1.token}` },
      body: JSON.stringify({
        orderId: orderSec.orderNumber,
        provider: "cbe",
        reference: `FT2611SEC${String(ts).slice(-5)}`,
        officialReceiptUrl: "https://transactioninfo.ethiotelecom.et/receipt/DKG490262A",
      }),
    });
    const secCrossHostJson = await secCrossHostRes.json();
    assert(
      secCrossHostRes.status === 400 && secCrossHostJson.code === "INVALID_OFFICIAL_RECEIPT_URL",
      `Expected 400 INVALID_OFFICIAL_RECEIPT_URL for Telebirr domain on CBE, got ${secCrossHostRes.status} ${JSON.stringify(secCrossHostJson)}`,
    );

    const secPayment = (await prisma.payment.findUnique({ where: { orderId: orderSec.dbId } }))!;
    const secReviewRes = await fetch(`${v1Url}/admin/payments/${secPayment.id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        decision: "approve",
        reason: "Testing arbitrary URL block",
        reference: `FT2611ADM${String(ts).slice(-5)}`,
        officialReceiptUrl: "https://evil.example/phish",
      }),
    });
    const secReviewJson = await secReviewRes.json();
    assert(
      secReviewRes.status === 400 && secReviewJson.code === "INVALID_OFFICIAL_RECEIPT_URL",
      `Expected 400 INVALID_OFFICIAL_RECEIPT_URL on admin review, got ${secReviewRes.status} ${JSON.stringify(secReviewJson)}`,
    );
    console.info("✓ Scenario 13 passed: Official Telebirr & CBE links, FT token refusal, status persistence, and domain allowlist enforced.");

    console.info("\n======================================================================");
    console.info("=== ALL 13 RECEIPT PERSISTENCE, OCR & OFFICIAL URL E2E PASSED!      ===");
    console.info("======================================================================");
  } finally {
    chekiClient.getBanks = origGetBanks;
    chekiClient.getHealth = origGetHealth;
    chekiClient.verifyReceipt = origVerifyReceipt;
    clearRateLimitBuckets();
    await shutdownOcrWorker().catch(() => {});

    for (const pubId of uploadedReceiptPublicIds) {
      await cloudinaryService
        .deleteImage(pubId, "authenticated", pubId.toLowerCase().endsWith(".pdf") ? "raw" : "image")
        .catch(() => {});
    }

    if (createdOrderIds.length > 0) {
      await prisma.paymentReceipt.deleteMany({ where: { orderId: { in: createdOrderIds } } });
      await prisma.paymentVerificationLog.deleteMany({ where: { orderId: { in: createdOrderIds } } });
      await prisma.payment.deleteMany({ where: { orderId: { in: createdOrderIds } } });
      await prisma.orderItem.deleteMany({ where: { orderId: { in: createdOrderIds } } });
      await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
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
      await prisma.notification.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.refreshToken.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }

    server.close();
    await prisma.$disconnect();
  }
}

runReceiptUploadE2E().catch((err) => {
  console.error("\n❌ Receipt OCR & Verification E2E Suite Failed:", err);
  process.exit(1);
});
