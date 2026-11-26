import crypto from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import { createApp } from "./src/app.js";
import { prisma } from "./src/config/database.js";
import { clearRateLimitBuckets } from "./src/middlewares/rate-limit.middleware.js";
import { cloudinaryService } from "./src/modules/media/cloudinary.service.js";
import { configureGoogleOAuthStrategy } from "./src/modules/auth/google-oauth.strategy.js";
import {
  chekiClient,
  type ChekiBankMetadata,
  type ChekiHealthBankItem,
  type ChekiVerifyOutcome,
  type ChekiVerifyRequest,
} from "./src/modules/payments/cheki.client.js";
import { ensurePaymentProviderConfigsSeeded } from "./src/modules/payments/payment-providers.seed.js";
import { receiptOcrService, shutdownOcrWorker } from "./src/modules/payments/receipt-ocr.service.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

function getSetCookieHeaders(res: Response): string[] {
  const headersObj = res.headers as unknown as { getSetCookie?: () => string[] };
  if (typeof headersObj.getSetCookie === "function") {
    return headersObj.getSetCookie();
  }
  const single = res.headers.get("set-cookie");
  return single ? [single] : [];
}

function extractCookieValue(setCookieHeaders: string[], name: string): string | null {
  for (const header of setCookieHeaders) {
    const firstPart = header.split(";")[0]?.trim() ?? "";
    if (firstPart.startsWith(`${name}=`)) {
      return firstPart.slice(name.length + 1);
    }
  }
  return null;
}

function createValidPngBuffer(): Buffer {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAANSURBVBhXY2Bw9P8PAAJlAZAZIj5CAAAAAElFTkSuQmCC",
    "base64",
  );
}

async function runCheckoutAuthE2E() {
  console.info("=========================================================================");
  console.info("=== ADDISGEBEYA GOOGLE ONE TAP, CART MERGE & GUEST CHECKOUT E2E SUITE ===");
  console.info("=========================================================================\n");

  const ts = Date.now();
  const createdEmails: string[] = [];
  const createdOrderIds: string[] = [];
  const createdOrderNumbers: string[] = [];
  const stockRestoreOps: Array<{ variantId: string; incrementBy: number }> = [];

  const originalEnv = {
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    BACKEND_URL: process.env.BACKEND_URL,
    FRONTEND_URL: process.env.FRONTEND_URL,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL,
  };

  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const testKid = `checkout-onetap-kid-${ts}`;
  const testClientId = `checkout-client-${ts}.apps.googleusercontent.com`;
  const testClientSecret = `checkout-secret-${ts}`;

  const app = createApp();
  const server = createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;
  const v1Url = `${baseUrl}/api/v1`;

  process.env.NODE_ENV = "test";
  process.env.PORT = String(port);
  process.env.BACKEND_URL = baseUrl;
  process.env.FRONTEND_URL = "http://localhost:3000,https://addisgebeya.et";
  process.env.GOOGLE_CLIENT_ID = testClientId;
  process.env.GOOGLE_CLIENT_SECRET = testClientSecret;
  process.env.GOOGLE_CALLBACK_URL = `${baseUrl}/api/auth/google/callback`;

  assert(configureGoogleOAuthStrategy(true), "Expected Google OAuth strategy to configure");

  const origGetFederatedSignonCertsAsync = OAuth2Client.prototype.getFederatedSignonCertsAsync;
  OAuth2Client.prototype.getFederatedSignonCertsAsync = (async () => ({
    certs: { [testKid]: publicKey },
    format: "PEM",
  })) as typeof origGetFederatedSignonCertsAsync;

  const origUploadSingle = cloudinaryService.uploadSingle.bind(cloudinaryService);
  const origExtractOcr = receiptOcrService.extractFromBuffer.bind(receiptOcrService);
  const origGetBanks = chekiClient.getBanks.bind(chekiClient);
  const origGetHealth = chekiClient.getHealth.bind(chekiClient);
  const origVerifyReceipt = chekiClient.verifyReceipt.bind(chekiClient);

  function signGoogleIdToken(claims: {
    sub: string;
    email: string;
    email_verified: boolean;
    name: string;
    picture?: string;
    aud?: string;
  }): string {
    return jwt.sign(
      {
        iss: "https://accounts.google.com",
        azp: claims.aud ?? testClientId,
        aud: claims.aud ?? testClientId,
        sub: claims.sub,
        email: claims.email,
        email_verified: claims.email_verified,
        name: claims.name,
        picture: claims.picture,
      },
      privateKey,
      {
        algorithm: "RS256",
        expiresIn: "10m",
        keyid: testKid,
      },
    );
  }

  try {
    clearRateLimitBuckets();
    await ensurePaymentProviderConfigsSeeded();

    const cbeCfg = await prisma.paymentProviderConfig.findUnique({ where: { providerCode: "cbe" } });
    assert(cbeCfg, "Expected CBE provider config to exist");

    const variants = await prisma.productVariant.findMany({
      where: {
        stockQuantity: { gte: 4 },
        product: { status: "active" },
      },
      include: { product: true, colorway: true },
      take: 2,
    });
    assert(variants.length >= 1, "Expected at least one in-stock active product variant");
    const primaryVariant = variants[0]!;
    const secondaryVariant = variants[1] ?? primaryVariant;

    // [Test 1] Public Google One Tap / GIS config must never expose clientSecret
    console.info("[Test 1] Checking public GIS config endpoint & zero secret exposure...");
    const configRes = await fetch(`${baseUrl}/api/auth/google/config`);
    assert(configRes.status === 200, `Expected 200 from /api/auth/google/config, got ${configRes.status}`);
    const configPayload = (await configRes.json()) as {
      success: boolean;
      data: { enabled: boolean; clientId: string | null; clientSecret?: unknown };
    };
    assert(
      configPayload.success &&
        configPayload.data.enabled === true &&
        configPayload.data.clientId === testClientId &&
        configPayload.data.clientSecret === undefined,
      "Expected enabled clientId without clientSecret",
    );
    console.info("✓ Public GIS config returned clientId safely with no secret exposure");

    // [Test 2] Google One Tap registration for brand-new checkout customer
    console.info("\n[Test 2] Google One Tap new customer registration & token/cookie issuance...");
    const oneTapEmail = `onetap.new.${ts}@example.com`;
    const oneTapSub = `goog-onetap-${ts}`;
    createdEmails.push(oneTapEmail);

    const newOneTapRes = await fetch(`${v1Url}/auth/google/one-tap`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:3000",
      },
      body: JSON.stringify({
        credential: signGoogleIdToken({
          sub: oneTapSub,
          email: oneTapEmail,
          email_verified: true,
          name: "Tigist Alemu",
        }),
        intent: "login",
      }),
    });
    assert(newOneTapRes.status === 200, `Expected 200 from One Tap signup, got ${newOneTapRes.status}`);
    const newOneTapJson = (await newOneTapRes.json()) as {
      success: boolean;
      data: {
        user: { id: string; email: string; role: string; name: string };
        accessToken: string;
        isNewUser: boolean;
      };
    };
    const refreshCookie1 = extractCookieValue(getSetCookieHeaders(newOneTapRes), "refreshToken");
    assert(
      newOneTapJson.data.isNewUser === true &&
        newOneTapJson.data.user.role === "customer" &&
        Boolean(newOneTapJson.data.accessToken) &&
        Boolean(refreshCookie1),
      "Expected newly created CUSTOMER user with accessToken and HTTP-only refreshToken cookie",
    );
    console.info(`✓ One Tap created CUSTOMER ${newOneTapJson.data.user.email} (${newOneTapJson.data.user.id})`);

    // [Test 3] Returning customer login + duplicate & conflict prevention
    console.info("\n[Test 3] Returning Google One Tap login & duplicate/conflict prevention...");
    const returningRes = await fetch(`${baseUrl}/api/auth/google/one-tap`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:3000",
      },
      body: JSON.stringify({
        credential: signGoogleIdToken({
          sub: oneTapSub,
          email: oneTapEmail,
          email_verified: true,
          name: "Tigist Alemu",
        }),
      }),
    });
    assert(returningRes.status === 200, `Expected 200 for returning One Tap login, got ${returningRes.status}`);
    const returningJson = (await returningRes.json()) as {
      data: { user: { id: string }; isNewUser: boolean; accessToken: string };
    };
    const refreshCookie2 = extractCookieValue(getSetCookieHeaders(returningRes), "refreshToken");
    assert(
      returningJson.data.isNewUser === false &&
        returningJson.data.user.id === newOneTapJson.data.user.id &&
        Boolean(refreshCookie2),
      "Returning One Tap user must reuse existing customer record without duplication",
    );
    const matchingUserCount = await prisma.user.count({ where: { email: oneTapEmail } });
    assert(matchingUserCount === 1, `Expected 1 user row for ${oneTapEmail}, found ${matchingUserCount}`);

    // Different Google sub claiming same email -> 409 conflict
    const conflictRes = await fetch(`${v1Url}/auth/google/one-tap`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
      body: JSON.stringify({
        credential: signGoogleIdToken({
          sub: `rogue-sub-${ts}`,
          email: oneTapEmail,
          email_verified: true,
          name: "Rogue Clone",
        }),
      }),
    });
    assert(conflictRes.status === 409, `Expected 409 OAUTH_ACCOUNT_CONFLICT, got ${conflictRes.status}`);
    console.info("✓ Returning customer logged in cleanly without duplication & conflicting sub blocked (409)");

    // [Test 4] One Tap security rejections (unverified email, bad aud, CSRF origin, g_csrf_token, suspended)
    console.info("\n[Test 4] Enforcing ID token verification, CSRF origin, g_csrf_token & suspension...");
    const unverifiedRes = await fetch(`${v1Url}/auth/google/one-tap`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
      body: JSON.stringify({
        credential: signGoogleIdToken({
          sub: `unverified-${ts}`,
          email: `unverified.${ts}@example.com`,
          email_verified: false,
          name: "Unverified User",
        }),
      }),
    });
    assert(unverifiedRes.status === 403, `Expected 403 EMAIL_NOT_VERIFIED, got ${unverifiedRes.status}`);

    const wrongAudRes = await fetch(`${v1Url}/auth/google/one-tap`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
      body: JSON.stringify({
        credential: signGoogleIdToken({
          sub: `wrongaud-${ts}`,
          email: `wrongaud.${ts}@example.com`,
          email_verified: true,
          name: "Wrong Aud",
          aud: "other-app.apps.googleusercontent.com",
        }),
      }),
    });
    assert(wrongAudRes.status === 401, `Expected 401 for wrong audience token, got ${wrongAudRes.status}`);

    const badOriginRes = await fetch(`${v1Url}/auth/google/one-tap`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://evil-phisher.example.com" },
      body: JSON.stringify({
        credential: signGoogleIdToken({
          sub: oneTapSub,
          email: oneTapEmail,
          email_verified: true,
          name: "Tigist Alemu",
        }),
      }),
    });
    assert(badOriginRes.status === 403, `Expected 403 for untrusted Origin, got ${badOriginRes.status}`);

    const badRefererRes = await fetch(`${v1Url}/auth/google/one-tap`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Referer: "https://evil-phisher.example.com/fake-checkout",
      },
      body: JSON.stringify({
        credential: signGoogleIdToken({
          sub: oneTapSub,
          email: oneTapEmail,
          email_verified: true,
          name: "Tigist Alemu",
        }),
      }),
    });
    assert(badRefererRes.status === 403, `Expected 403 for untrusted Referer, got ${badRefererRes.status}`);

    const csrfMismatchRes = await fetch(`${v1Url}/auth/google/one-tap`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:3000",
        Cookie: "g_csrf_token=cookie-secret-123",
      },
      body: JSON.stringify({
        credential: signGoogleIdToken({
          sub: oneTapSub,
          email: oneTapEmail,
          email_verified: true,
          name: "Tigist Alemu",
        }),
        g_csrf_token: "wrong-csrf-token",
      }),
    });
    assert(csrfMismatchRes.status === 403, `Expected 403 for g_csrf_token mismatch, got ${csrfMismatchRes.status}`);

    // Suspend user temporarily and confirm One Tap blocks
    await prisma.user.update({ where: { id: newOneTapJson.data.user.id }, data: { isActive: false } });
    const suspendedRes = await fetch(`${v1Url}/auth/google/one-tap`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
      body: JSON.stringify({
        credential: signGoogleIdToken({
          sub: oneTapSub,
          email: oneTapEmail,
          email_verified: true,
          name: "Tigist Alemu",
        }),
      }),
    });
    assert(suspendedRes.status === 403, `Expected 403 for suspended customer, got ${suspendedRes.status}`);
    await prisma.user.update({ where: { id: newOneTapJson.data.user.id }, data: { isActive: true } });
    console.info("✓ All One Tap security gates passed cleanly");

    // [Test 5] Expired access session + refresh token rotation
    console.info("\n[Test 5] Verifying expired session rejection & HTTP-only refresh token rotation...");
    const expiredMeRes = await fetch(`${v1Url}/auth/me`, {
      headers: { Authorization: "Bearer expired.invalid.jwt" },
    });
    assert(expiredMeRes.status === 401, `Expected 401 for expired JWT, got ${expiredMeRes.status}`);

    const refreshRes = await fetch(`${v1Url}/auth/refresh-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `refreshToken=${refreshCookie2}`,
      },
    });
    assert(refreshRes.status === 200, `Expected 200 on refresh rotation, got ${refreshRes.status}`);
    const refreshJson = (await refreshRes.json()) as {
      data: { accessToken: string };
    };
    assert(Boolean(refreshJson.data.accessToken), "Expected new accessToken after refresh");
    const activeCustomerToken = refreshJson.data.accessToken;
    console.info("✓ Refresh cookie rotation recovered expired session cleanly");

    // [Test 6] Guest Cart Persistence + Auth Cart Merge (dedup, stock clamping, backend prices)
    console.info("\n[Test 6] Testing guest DB cart persistence & post-login cart merge...");
    // Seed 1 saved item in customer's DB cart
    const addSavedRes = await fetch(`${v1Url}/cart/items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${activeCustomerToken}`,
      },
      body: JSON.stringify({
        productId: primaryVariant.productId,
        colorwayId: primaryVariant.colorwayId,
        size: primaryVariant.size,
        quantity: 1,
      }),
    });
    assert(
      addSavedRes.status === 201 || addSavedRes.status === 200,
      `Expected 200/201 seeding customer cart, got ${addSavedRes.status}`,
    );

    // Guest adds same SKU (qty 2) to get signed ag_guest_session cookie
    const guestCartAddRes = await fetch(`${v1Url}/cart/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: primaryVariant.productId,
        colorwayId: primaryVariant.colorwayId,
        size: primaryVariant.size,
        quantity: 2,
      }),
    });
    assert(
      guestCartAddRes.status === 201 || guestCartAddRes.status === 200,
      `Expected 200/201 adding guest cart item, got ${guestCartAddRes.status}`,
    );
    const guestCartCookie = extractCookieValue(getSetCookieHeaders(guestCartAddRes), "ag_guest_session");
    assert(guestCartCookie, "Expected ag_guest_session HTTP-only cookie from guest cart mutation");

    // Merge with both ag_guest_session cookie AND mirrored clientItems + oversized quantity attempt
    const expectedPrice =
      Number(primaryVariant.product.priceETB) + Number(primaryVariant.priceAdjustment ?? 0);
    const mergeRes = await fetch(`${v1Url}/cart/merge`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${activeCustomerToken}`,
        Cookie: `ag_guest_session=${guestCartCookie}`,
      },
      body: JSON.stringify({
        items: [
          {
            productId: primaryVariant.productId,
            colorwayId: primaryVariant.colorwayId,
            size: primaryVariant.size,
            quantity: 2, // mirrors guest DB item -> must NOT double-count into 1+2+2=5!
          },
          ...(secondaryVariant.id !== primaryVariant.id
            ? [
                {
                  productId: secondaryVariant.productId,
                  colorwayId: secondaryVariant.colorwayId,
                  size: secondaryVariant.size,
                  quantity: 20, // exceeds max cap (5) -> must clamp + emit warning
                },
              ]
            : []),
        ],
      }),
    });
    assert(mergeRes.status === 200, `Expected 200 on POST /cart/merge, got ${mergeRes.status}`);
    const mergeJson = (await mergeRes.json()) as {
      data: {
        items: Array<{
          productId: string;
          colorwayId: string;
          size: number;
          quantity: number;
          unitPriceETB: number;
        }>;
        warnings: string[];
      };
    };
    const mergedPrimary = mergeJson.data.items.find(
      (i) =>
        i.productId === primaryVariant.productId &&
        i.colorwayId === primaryVariant.colorwayId &&
        i.size === primaryVariant.size,
    );
    const expectedMergedPrimaryQty = Math.min(primaryVariant.stockQuantity, 5, 1 + 2);
    assert(
      mergedPrimary &&
        mergedPrimary.quantity === expectedMergedPrimaryQty &&
        mergedPrimary.unitPriceETB === expectedPrice,
      `Expected merged primary qty ${expectedMergedPrimaryQty} at price ${expectedPrice}, got ${JSON.stringify(mergedPrimary)}`,
    );
    if (secondaryVariant.id !== primaryVariant.id) {
      const mergedSecondary = mergeJson.data.items.find(
        (i) =>
          i.productId === secondaryVariant.productId &&
          i.colorwayId === secondaryVariant.colorwayId &&
          i.size === secondaryVariant.size,
      );
      assert(
        mergedSecondary &&
          mergedSecondary.quantity === Math.min(secondaryVariant.stockQuantity, 10) &&
          mergeJson.data.warnings.length > 0,
        `Expected secondary item quantity to clamp cleanly to ${Math.min(secondaryVariant.stockQuantity, 10)} with warning, got ${JSON.stringify(mergedSecondary)} / warnings=${JSON.stringify(mergeJson.data.warnings)}`,
      );
    }
    console.info("✓ Guest cart merged transactionally without duplication, with live pricing & stock clamp");

    // [Test 7] Guest COD Order Creation & backend authoritative pricing (ignores client forged unitPriceETB)
    console.info("\n[Test 7] Placing Guest COD Order with price tamper protection...");
    const guestEmail = `guest.buyer.${ts}@example.com`;
    const codRes = await fetch(`${v1Url}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: "Selamawit Bekele",
        customerEmail: guestEmail,
        customerPhone: "+251 911 554433",
        city: "Addis Ababa",
        subCity: "Bole (Rwanda / Edna / Japan / Atlas)",
        landmark: "Near Edna Mall 2nd Entrance",
        deliverySpeed: "standard",
        paymentMethod: "cod",
        items: [
          {
            productId: primaryVariant.productId,
            colorwayId: primaryVariant.colorwayId,
            productName: primaryVariant.product.name,
            colorwayName: primaryVariant.colorway.name,
            size: primaryVariant.size,
            quantity: 1,
            unitPriceETB: 1, // Tampered low price — backend must ignore!
            image: primaryVariant.colorway.images[0] ?? "/images/placeholder-shoe.png",
          },
        ],
      }),
    });
    assert(codRes.status === 201, `Expected 201 for Guest COD order, got ${codRes.status}`);
    const codJson = (await codRes.json()) as {
      data: { id: string; dbId: string; totalETB: number; customerId: string; paymentStatus: string };
    };
    const guestOrderCookie = extractCookieValue(getSetCookieHeaders(codRes), "ag_guest_session");
    createdOrderIds.push(codJson.data.dbId);
    createdOrderNumbers.push(codJson.data.id);
    stockRestoreOps.push({ variantId: primaryVariant.id, incrementBy: 1 });

    assert(
      codJson.data.customerId === "guest" &&
        codJson.data.paymentStatus === "cod_due" &&
        codJson.data.totalETB >= expectedPrice &&
        Boolean(guestOrderCookie),
      `Expected authoritative price >= ${expectedPrice} and ag_guest_session cookie, got ${JSON.stringify(codJson.data)}`,
    );
    console.info(`✓ Guest COD Order #${codJson.data.id} created with backend price ${codJson.data.totalETB} ETB`);

    // [Test 8] Guest Bank Payment Verification & Receipt Upload via signed guest cookie
    console.info("\n[Test 8] Verifying Guest Cheki payment + receipt submission...");
    const cbeOrderRes = await fetch(`${v1Url}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `ag_guest_session=${guestOrderCookie}`,
      },
      body: JSON.stringify({
        customerName: "Selamawit Bekele",
        customerEmail: guestEmail,
        customerPhone: "+251 911 554433",
        city: "Addis Ababa",
        subCity: "Kazanchis",
        landmark: "Near ECA Gate",
        deliverySpeed: "standard",
        paymentMethod: "cbe",
        items: [
          {
            productId: primaryVariant.productId,
            colorwayId: primaryVariant.colorwayId,
            productName: primaryVariant.product.name,
            colorwayName: primaryVariant.colorway.name,
            size: primaryVariant.size,
            quantity: 1,
            image: primaryVariant.colorway.images[0] ?? "/images/placeholder-shoe.png",
          },
        ],
      }),
    });
    assert(cbeOrderRes.status === 201, `Expected 201 for Guest CBE order, got ${cbeOrderRes.status}`);
    const cbeOrderJson = (await cbeOrderRes.json()) as {
      data: { id: string; dbId: string; totalETB: number };
    };
    createdOrderIds.push(cbeOrderJson.data.dbId);
    createdOrderNumbers.push(cbeOrderJson.data.id);
    stockRestoreOps.push({ variantId: primaryVariant.id, incrementBy: 1 });

    // Stub Cloudinary / OCR / Cheki cleanly in test
    const guestCbeRef = `FT2611GST${String(ts).slice(-6)}`;
    cloudinaryService.uploadSingle = async () => ({
      publicId: `addisgebeya/receipts/guest_${ts}`,
      secureUrl: `https://res.cloudinary.com/demo/image/upload/v1/addisgebeya/receipts/guest_${ts}.png`,
      format: "png",
      width: 1,
      height: 1,
      bytes: 95,
      resourceType: "image",
    });
    receiptOcrService.extractFromBuffer = async () => ({
      extractedReference: guestCbeRef,
      extractedAmountETB: cbeOrderJson.data.totalETB,
      extractedDate: new Date().toISOString(),
      extractedSenderName: "Selamawit Bekele",
      extractedSenderAccount: "1000****1122",
      extractedReceiverName: cbeCfg.receivingAccountName,
      extractedReceiverAccount: cbeCfg.receivingAccountNumber,
      extractedStatus: "Completed",
      extractedQrData: null,
      officialReceiptUrl: null,
      cbeReceiptToken: null,
      detectedProvider: "cbe",
      confidence: 0.96,
      rawTextPreview: `Reference No: ${guestCbeRef}`,
    });

    const mockBanks: ChekiBankMetadata[] = [
      {
        id: "cbe",
        name: "Commercial Bank of Ethiopia",
        type: "bank",
        status: "live",
        requiresAccount: false,
        color: "#7C3AED",
        initials: "CBE",
        formats: [{ id: "ft", status: "live", label: "FT Ref", inputs: ["reference"], supported: true }],
      },
    ];
    const mockHealth: ChekiHealthBankItem[] = [
      { id: "cbe", name: "Commercial Bank of Ethiopia", status: "reachable", latencyMs: 25 },
    ];
    chekiClient.getBanks = async () => mockBanks;
    chekiClient.getHealth = async () => mockHealth;
    chekiClient.verifyReceipt = async (req: ChekiVerifyRequest): Promise<ChekiVerifyOutcome> => ({
      outcome: "ok",
      data: {
        success: true,
        verified: true,
        bank: "Commercial Bank of Ethiopia",
        bankCode: "cbe",
        reference: (req.reference || guestCbeRef).toUpperCase(),
        amount: cbeOrderJson.data.totalETB,
        currency: "ETB",
        senderName: "Selamawit Bekele",
        senderAccount: "1000****1122",
        receiverName: cbeCfg.receivingAccountName,
        receiverAccount: cbeCfg.receivingAccountNumber,
        date: new Date().toISOString(),
      },
    });

    const fd = new FormData();
    fd.append("orderId", cbeOrderJson.data.id);
    fd.append("provider", "cbe");
    fd.append("reference", guestCbeRef);
    fd.append("autoVerify", "true");
    fd.append(
      "receipt",
      new Blob([new Uint8Array(createValidPngBuffer())], { type: "image/png" }),
      "guest-cbe.png",
    );

    const guestReceiptRes = await fetch(`${v1Url}/payment/receipts`, {
      method: "POST",
      headers: { Cookie: `ag_guest_session=${guestOrderCookie}` },
      body: fd,
    });
    assert(guestReceiptRes.status === 201, `Expected 201 on guest receipt submit, got ${guestReceiptRes.status}`);
    const guestReceiptJson = (await guestReceiptRes.json()) as {
      data: {
        paymentStatus: string;
        orderStatus: string;
        receipt: { id: string; status: string };
      };
    };
    assert(
      guestReceiptJson.data.paymentStatus === "Paid" &&
        guestReceiptJson.data.orderStatus === "Confirmed",
      `Expected guest receipt to verify Paid/Confirmed, got ${JSON.stringify(guestReceiptJson.data)}`,
    );

    const guestOrderViewRes = await fetch(`${v1Url}/orders/${cbeOrderJson.data.id}`, {
      headers: { Cookie: `ag_guest_session=${guestOrderCookie}` },
    });
    assert(guestOrderViewRes.status === 200, `Expected 200 for guest own order, got ${guestOrderViewRes.status}`);

    const guestReceiptAccessRes = await fetch(
      `${v1Url}/payment/receipts/${guestReceiptJson.data.receipt.id}/access`,
      {
        method: "POST",
        headers: { Cookie: `ag_guest_session=${guestOrderCookie}` },
      },
    );
    assert(
      guestReceiptAccessRes.status === 200,
      `Expected 200 minting guest receipt access token, got ${guestReceiptAccessRes.status}`,
    );
    console.info(`✓ Guest receipt uploaded, auto-verified & order #${cbeOrderJson.data.id} confirmed`);

    // [Test 9] Cross-User & Missing-Cookie Isolation
    console.info("\n[Test 9] Verifying strict cross-user & unauthenticated isolation...");
    const noAuthOrderRes = await fetch(`${v1Url}/orders/${cbeOrderJson.data.id}`);
    assert(noAuthOrderRes.status === 401, `Expected 401 without auth/guest cookie, got ${noAuthOrderRes.status}`);

    const noAuthPayStatusRes = await fetch(`${v1Url}/payment/status/${cbeOrderJson.data.id}`);
    assert(
      noAuthPayStatusRes.status === 401,
      `Expected 401 on payment status without auth/guest cookie, got ${noAuthPayStatusRes.status}`,
    );

    const otherUserOrderRes = await fetch(`${v1Url}/orders/${cbeOrderJson.data.id}`, {
      headers: { Authorization: `Bearer ${activeCustomerToken}` },
    });
    assert(
      otherUserOrderRes.status === 403,
      `Expected 403 when unrelated customer accesses guest order, got ${otherUserOrderRes.status}`,
    );

    const otherUserPayStatusRes = await fetch(`${v1Url}/payment/status/${cbeOrderJson.data.id}`, {
      headers: { Authorization: `Bearer ${activeCustomerToken}` },
    });
    assert(
      otherUserPayStatusRes.status === 403,
      `Expected 403 when unrelated customer checks guest payment status, got ${otherUserPayStatusRes.status}`,
    );
    console.info("✓ Missing-session (401) and cross-user isolation (403) enforced cleanly");

    // [Test 10] Public Order Tracking Lookup
    console.info("\n[Test 10] Testing public POST /orders/track verification...");
    const trackValidRes = await fetch(`${v1Url}/orders/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderNumber: cbeOrderJson.data.id,
        email: guestEmail.toUpperCase(),
      }),
    });
    assert(trackValidRes.status === 200, `Expected 200 from public order tracking, got ${trackValidRes.status}`);
    const trackValidJson = (await trackValidRes.json()) as {
      data: { id: string; status: string; trackingEvents: unknown[] };
    };
    assert(
      trackValidJson.data.id === cbeOrderJson.data.id &&
        trackValidJson.data.status === "Confirmed" &&
        trackValidJson.data.trackingEvents.length > 0,
      "Expected matching Confirmed tracking details",
    );

    const trackWrongEmailRes = await fetch(`${v1Url}/orders/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderNumber: cbeOrderJson.data.id,
        email: "wrong-email@example.com",
      }),
    });
    assert(
      trackWrongEmailRes.status === 404,
      `Expected 404 for wrong email tracking lookup, got ${trackWrongEmailRes.status}`,
    );
    console.info("✓ Public tracking endpoint works with orderNumber+email & hides unmatched lookups");

    console.info("\n=========================================================================");
    console.info("=== ALL 10 CHECKOUT AUTH, CART MERGE & GUEST CHECKOUT TESTS PASSED!    ===");
    console.info("=========================================================================");
  } finally {
    OAuth2Client.prototype.getFederatedSignonCertsAsync = origGetFederatedSignonCertsAsync;
    cloudinaryService.uploadSingle = origUploadSingle;
    receiptOcrService.extractFromBuffer = origExtractOcr;
    chekiClient.getBanks = origGetBanks;
    chekiClient.getHealth = origGetHealth;
    chekiClient.verifyReceipt = origVerifyReceipt;
    await shutdownOcrWorker().catch(() => {});

    for (const op of stockRestoreOps) {
      await prisma.productVariant
        .update({
          where: { id: op.variantId },
          data: { stockQuantity: { increment: op.incrementBy } },
        })
        .catch(() => {});
    }

    if (createdOrderNumbers.length > 0) {
      await prisma.notification
        .deleteMany({
          where: {
            relatedEntityType: { in: ["order", "payment"] },
            relatedEntityId: { in: createdOrderNumbers },
          },
        })
        .catch(() => {});
    }
    if (createdOrderIds.length > 0) {
      await prisma.paymentVerificationLog
        .deleteMany({ where: { orderId: { in: createdOrderIds } } })
        .catch(() => {});
      await prisma.paymentReceipt
        .deleteMany({ where: { orderId: { in: createdOrderIds } } })
        .catch(() => {});
      await prisma.payment
        .deleteMany({ where: { orderId: { in: createdOrderIds } } })
        .catch(() => {});
      await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } }).catch(() => {});
    }

    if (createdEmails.length > 0) {
      const users = await prisma.user.findMany({
        where: { email: { in: createdEmails } },
        select: { id: true },
      });
      const ids = users.map((u) => u.id);
      if (ids.length > 0) {
        await prisma.notification
          .deleteMany({ where: { relatedEntityType: "customer", relatedEntityId: { in: ids } } })
          .catch(() => {});
        await prisma.user.deleteMany({ where: { id: { in: ids } } }).catch(() => {});
      }
    }

    await prisma.cart
      .deleteMany({
        where: {
          guestSessionId: { not: null },
          items: { none: {} },
        },
      })
      .catch(() => {});

    for (const [k, v] of Object.entries(originalEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }

    await prisma.$disconnect();
    server.close();
  }
}

runCheckoutAuthE2E().catch(async (err) => {
  console.error("\n❌ Checkout Auth & Guest Checkout E2E Suite Failed:", err);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
