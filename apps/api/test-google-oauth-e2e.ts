import crypto from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import passport from "passport";
import { createApp } from "./src/app.js";
import { prisma } from "./src/config/database.js";
import {
  configureGoogleOAuthStrategy,
  resolveFrontendOAuthRedirectUrl,
} from "./src/modules/auth/google-oauth.strategy.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

interface MockGoogleOAuthScenario {
  idToken: string;
  accessToken: string;
  profile: Record<string, unknown>;
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

function getSetCookieHeaders(res: Response): string[] {
  const headersObj = res.headers as unknown as { getSetCookie?: () => string[] };
  if (typeof headersObj.getSetCookie === "function") {
    return headersObj.getSetCookie();
  }
  const single = res.headers.get("set-cookie");
  return single ? [single] : [];
}

async function runGoogleOAuthE2E() {
  console.info("=========================================================================");
  console.info("=== ADDISGEBEYA GOOGLE OAUTH 2.0 END-TO-END TEST SUITE                ===");
  console.info("=========================================================================\n");

  const ts = Date.now();
  const createdEmails: string[] = [];

  const originalEnv = {
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    BACKEND_URL: process.env.BACKEND_URL,
    FRONTEND_URL: process.env.FRONTEND_URL,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL,
    GOOGLE_OAUTH_REDIRECT_URL_DEV: process.env.GOOGLE_OAUTH_REDIRECT_URL_DEV,
    GOOGLE_OAUTH_REDIRECT_URL_PROD: process.env.GOOGLE_OAUTH_REDIRECT_URL_PROD,
  };

  // Generate real RS256 keypair for OIDC ID token cryptographic verification
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const testKid = `google-e2e-kid-${ts}`;
  const testClientId = `test-client-${ts}.apps.googleusercontent.com`;
  const testClientSecret = `test-secret-${ts}`;

  const app = createApp();
  const server = createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  process.env.NODE_ENV = "test";
  process.env.PORT = String(port);
  process.env.BACKEND_URL = baseUrl;
  process.env.FRONTEND_URL = "http://localhost:3000,https://addisgebeya.et";
  process.env.GOOGLE_CLIENT_ID = testClientId;
  process.env.GOOGLE_CLIENT_SECRET = testClientSecret;
  process.env.GOOGLE_CALLBACK_URL = `${baseUrl}/api/auth/google/callback`;
  process.env.GOOGLE_OAUTH_REDIRECT_URL_DEV = "http://localhost:3000/auth/google/callback";
  process.env.GOOGLE_OAUTH_REDIRECT_URL_PROD = "https://addisgebeya.et/auth/google/callback";

  assert(configureGoogleOAuthStrategy(true), "Expected Google OAuth strategy to configure");

  const origGetFederatedSignonCertsAsync = OAuth2Client.prototype.getFederatedSignonCertsAsync;
  OAuth2Client.prototype.getFederatedSignonCertsAsync = (async () => ({
    certs: { [testKid]: publicKey },
    format: "PEM",
  })) as typeof origGetFederatedSignonCertsAsync;

  const scenarios = new Map<string, MockGoogleOAuthScenario>();
  const googleStrategy = (
    passport as unknown as {
      _strategy: (name: string) => {
        _oauth2: {
          getOAuthAccessToken: (
            code: string,
            params: Record<string, unknown>,
            cb: (
              err: unknown,
              accessToken?: string,
              refreshToken?: string,
              results?: Record<string, unknown>,
            ) => void,
          ) => void;
        };
        userProfile: (
          accessToken: string,
          done: (err?: unknown, profile?: unknown) => void,
        ) => void;
      };
    }
  )._strategy("google");

  assert(googleStrategy && googleStrategy._oauth2, "Expected Passport google strategy to exist");

  const accessTokenToProfile = new Map<string, Record<string, unknown>>();
  googleStrategy._oauth2.getOAuthAccessToken = (code, _params, cb) => {
    const scenario = scenarios.get(code);
    if (!scenario) {
      cb(new Error(`Unknown OAuth authorization code: ${code}`));
      return;
    }
    accessTokenToProfile.set(scenario.accessToken, scenario.profile);
    cb(null, scenario.accessToken, undefined, {
      access_token: scenario.accessToken,
      id_token: scenario.idToken,
      token_type: "Bearer",
      expires_in: 3600,
      scope: "openid email profile",
    });
  };
  googleStrategy.userProfile = (accessToken, done) => {
    const profile = accessTokenToProfile.get(accessToken);
    if (!profile) {
      done(new Error("Missing userinfo for access token"));
      return;
    }
    done(null, profile);
  };

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

  async function startGoogleFlow(params?: { intent?: "login" | "register"; from?: string; origin?: string }) {
    const url = new URL(`${baseUrl}/api/auth/google`);
    if (params?.intent) url.searchParams.set("intent", params.intent);
    if (params?.from) url.searchParams.set("from", params.from);
    if (params?.origin) url.searchParams.set("origin", params.origin);

    const res = await fetch(url.toString(), { redirect: "manual" });
    assert(res.status === 302, `Expected 302 from GET /api/auth/google, got ${res.status}`);
    const location = res.headers.get("location");
    assert(location, "Expected Location header from /api/auth/google");
    const authUrl = new URL(location);
    const setCookies = getSetCookieHeaders(res);
    const stateCookie = extractCookieValue(setCookies, "ag_oauth_state");
    assert(stateCookie, "Expected ag_oauth_state HTTP-only CSRF cookie");

    return { authUrl, state: authUrl.searchParams.get("state") ?? "", stateCookie, setCookies };
  }

  try {
    // [Test 1] Redirect URL resolution (local vs production) + open-redirect protection
    console.info("[Test 1] Verifying dev/prod redirect URLs, CORS protection & OAuth initiation...");
    process.env.NODE_ENV = "development";
    assert(
      resolveFrontendOAuthRedirectUrl("http://localhost:3000") ===
        "http://localhost:3000/auth/google/callback",
      "Expected dev redirect URL to resolve to localhost callback",
    );
    assert(
      resolveFrontendOAuthRedirectUrl("https://evil-attacker.example.com") ===
        "http://localhost:3000/auth/google/callback",
      "Open-redirect origin should be blocked and fall back cleanly",
    );
    process.env.NODE_ENV = "production";
    assert(
      resolveFrontendOAuthRedirectUrl("https://addisgebeya.et") ===
        "https://addisgebeya.et/auth/google/callback",
      "Expected prod redirect URL to resolve to production callback",
    );
    assert(
      resolveFrontendOAuthRedirectUrl("https://evil-attacker.example.com") ===
        "https://addisgebeya.et/auth/google/callback",
      "Production open-redirect origin should be blocked",
    );
    process.env.NODE_ENV = "test";

    const initFlow = await startGoogleFlow({ intent: "register", from: "/checkout" });
    assert(
      initFlow.authUrl.hostname === "accounts.google.com",
      `Expected Google consent URL, got ${initFlow.authUrl.toString()}`,
    );
    assert(
      initFlow.authUrl.searchParams.get("client_id") === testClientId,
      "Expected GOOGLE_CLIENT_ID in auth redirect",
    );
    assert(
      initFlow.setCookies.some((c) => c.includes("ag_oauth_state=") && c.includes("HttpOnly")),
      "Expected HttpOnly on OAuth state CSRF cookie",
    );
    console.info("✓ Dev/prod redirect URLs, CSRF state cookie, and Google consent redirect verified");

    // [Test 2] State tampering, missing cookie & OAuth cancellation handling
    console.info("\n[Test 2] Testing OAuth CSRF state validation & user cancellation...");
    const tamperedCb = await fetch(
      `${baseUrl}/api/auth/google/callback?code=fake&state=${encodeURIComponent(initFlow.state)}`,
      { redirect: "manual" },
    );
    assert(tamperedCb.status === 302, "Expected 302 redirect on missing CSRF cookie");
    const tamperedLoc = new URL(tamperedCb.headers.get("location")!);
    assert(
      tamperedLoc.searchParams.get("status") === "error" &&
        tamperedLoc.searchParams.get("error") === "INVALID_OAUTH_STATE",
      `Expected INVALID_OAUTH_STATE redirect, got ${tamperedLoc.toString()}`,
    );

    const cancelFlow = await startGoogleFlow({ intent: "login" });
    const cancelCb = await fetch(
      `${baseUrl}/api/auth/google/callback?error=access_denied&state=${encodeURIComponent(cancelFlow.state)}`,
      {
        redirect: "manual",
        headers: { Cookie: `ag_oauth_state=${cancelFlow.stateCookie}` },
      },
    );
    const cancelLoc = new URL(cancelCb.headers.get("location")!);
    assert(
      cancelLoc.searchParams.get("status") === "error" &&
        cancelLoc.searchParams.get("error") === "OAUTH_CANCELLED",
      `Expected OAUTH_CANCELLED on denied consent, got ${cancelLoc.toString()}`,
    );
    console.info("✓ OAuth CSRF tampering blocked & access_denied cancellation handled gracefully");

    // [Test 3] Unverified email & wrong audience cryptographic rejection
    console.info("\n[Test 3] Rejecting unverified email & invalid ID token audience...");
    const unverifiedEmail = `unverified.google.${ts}@example.com`;
    createdEmails.push(unverifiedEmail);

    const unverifiedCode = `code-unverified-${ts}`;
    scenarios.set(unverifiedCode, {
      accessToken: `goog-access-unverified-${ts}`,
      idToken: signGoogleIdToken({
        sub: `goog-sub-unverified-${ts}`,
        email: unverifiedEmail,
        email_verified: false,
        name: "Unverified Google User",
      }),
      profile: {
        provider: "google",
        id: `goog-sub-unverified-${ts}`,
        displayName: "Unverified Google User",
      },
    });
    const unverifiedStart = await startGoogleFlow({ intent: "register" });
    const unverifiedCb = await fetch(
      `${baseUrl}/api/auth/google/callback?code=${unverifiedCode}&state=${encodeURIComponent(unverifiedStart.state)}`,
      {
        redirect: "manual",
        headers: { Cookie: `ag_oauth_state=${unverifiedStart.stateCookie}` },
      },
    );
    const unverifiedLoc = new URL(unverifiedCb.headers.get("location")!);
    assert(
      unverifiedLoc.searchParams.get("status") === "error" &&
        unverifiedLoc.searchParams.get("error") === "EMAIL_NOT_VERIFIED",
      `Expected EMAIL_NOT_VERIFIED, got ${unverifiedLoc.toString()}`,
    );
    assert(
      !(await prisma.user.findUnique({ where: { email: unverifiedEmail } })),
      "Unverified Google account must NOT create a user record",
    );

    const wrongAudEmail = `wrongaud.google.${ts}@example.com`;
    createdEmails.push(wrongAudEmail);
    const wrongAudCode = `code-wrongaud-${ts}`;
    scenarios.set(wrongAudCode, {
      accessToken: `goog-access-wrongaud-${ts}`,
      idToken: signGoogleIdToken({
        sub: `goog-sub-wrongaud-${ts}`,
        email: wrongAudEmail,
        email_verified: true,
        name: "Wrong Audience User",
        aud: "malicious-other-client.apps.googleusercontent.com",
      }),
      profile: {
        provider: "google",
        id: `goog-sub-wrongaud-${ts}`,
        displayName: "Wrong Audience User",
      },
    });
    const wrongAudStart = await startGoogleFlow({ intent: "login" });
    const wrongAudCb = await fetch(
      `${baseUrl}/api/auth/google/callback?code=${wrongAudCode}&state=${encodeURIComponent(wrongAudStart.state)}`,
      {
        redirect: "manual",
        headers: { Cookie: `ag_oauth_state=${wrongAudStart.stateCookie}` },
      },
    );
    const wrongAudLoc = new URL(wrongAudCb.headers.get("location")!);
    assert(
      wrongAudLoc.searchParams.get("status") === "error" &&
        wrongAudLoc.searchParams.get("error") === "INVALID_GOOGLE_ID_TOKEN",
      `Expected INVALID_GOOGLE_ID_TOKEN for wrong audience, got ${wrongAudLoc.toString()}`,
    );
    console.info("✓ Unverified Google emails & wrong-audience ID tokens cryptographically rejected");

    // [Test 4] Google Registration for New Customer + JWT Session + Cookie Refresh + Avatar + Notification
    console.info("\n[Test 4] Testing new customer Google registration & HTTP-only cookie session...");
    const newGoogleEmail = `google.new.${ts}@example.com`;
    const newGoogleSub = `google-sub-new-${ts}`;
    const newGoogleAvatar = "https://lh3.googleusercontent.com/a/ACg8ocTestRealProfileAvatar=s96-c";
    const rawGoogleAccessToken = `goog-provider-access-${ts}`;
    createdEmails.push(newGoogleEmail);

    const regCode = `code-new-reg-${ts}`;
    scenarios.set(regCode, {
      accessToken: rawGoogleAccessToken,
      idToken: signGoogleIdToken({
        sub: newGoogleSub,
        email: newGoogleEmail,
        email_verified: true,
        name: "Mekdes Abebe",
        picture: newGoogleAvatar,
      }),
      profile: {
        provider: "google",
        id: newGoogleSub,
        displayName: "Mekdes Abebe",
        emails: [{ value: newGoogleEmail, verified: true }],
        photos: [{ value: newGoogleAvatar }],
      },
    });

    const regStart = await startGoogleFlow({ intent: "register", from: "/checkout" });
    const regCb = await fetch(
      `${baseUrl}/api/auth/google/callback?code=${regCode}&state=${encodeURIComponent(regStart.state)}`,
      {
        redirect: "manual",
        headers: { Cookie: `ag_oauth_state=${regStart.stateCookie}` },
      },
    );
    assert(regCb.status === 302, `Expected 302 redirect on Google registration, got ${regCb.status}`);

    const regRedirect = new URL(regCb.headers.get("location")!);
    assert(
      regRedirect.searchParams.get("status") === "success" &&
        regRedirect.searchParams.get("isNewUser") === "true" &&
        regRedirect.searchParams.get("linked") === "false" &&
        regRedirect.searchParams.get("from") === "/checkout",
      `Unexpected registration redirect params: ${regRedirect.toString()}`,
    );
    assert(
      !regRedirect.searchParams.has("accessToken") && !regRedirect.searchParams.has("refreshToken"),
      "Security violation: tokens must NOT be leaked in callback redirect URL",
    );

    const regSetCookies = getSetCookieHeaders(regCb);
    const regRefreshCookie = extractCookieValue(regSetCookies, "refreshToken");
    assert(regRefreshCookie, "Expected HTTP-only refreshToken cookie from Google callback");
    assert(
      regSetCookies.some(
        (c) => c.includes("refreshToken=") && c.includes("HttpOnly") && c.includes("Path=/api"),
      ),
      `Expected HttpOnly & Path=/api on refreshToken cookie, got: ${regSetCookies.join(" | ")}`,
    );

    const dbNewUser = await prisma.user.findUnique({
      where: { email: newGoogleEmail },
      include: { oauthAccounts: true },
    });
    assert(dbNewUser, "Expected new Google user to be persisted in PostgreSQL");
    assert(dbNewUser.role === "CUSTOMER", `Expected CUSTOMER role, got ${dbNewUser.role}`);
    assert(dbNewUser.passwordHash === null, "Google-only account should have null passwordHash");
    assert(dbNewUser.emailVerifiedAt !== null, "Expected emailVerifiedAt to be populated");
    assert(dbNewUser.avatarUrl === newGoogleAvatar, "Expected Google profile image to be saved");
    assert(
      dbNewUser.oauthAccounts.length === 1 &&
        dbNewUser.oauthAccounts[0]!.provider === "GOOGLE" &&
        dbNewUser.oauthAccounts[0]!.providerAccountId === newGoogleSub,
      "Expected linked GOOGLE OAuthAccount row",
    );

    // Confirm Google's own access token cannot be used as an AddisGebeya Bearer token
    const rejectGoogleTokenRes = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${rawGoogleAccessToken}` },
    });
    assert(
      rejectGoogleTokenRes.status === 401,
      `Google access token must NOT be accepted as app token (got ${rejectGoogleTokenRes.status})`,
    );

    // Exchange HTTP-only cookie via /auth/refresh-token (simulating frontend callback completion)
    const refreshRes1 = await fetch(`${baseUrl}/api/v1/auth/refresh-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `refreshToken=${regRefreshCookie}`,
      },
    });
    const refreshJson1 = await refreshRes1.json();
    assert(
      refreshRes1.status === 200 &&
        refreshJson1.data?.accessToken &&
        refreshJson1.data?.user?.id === dbNewUser.id &&
        refreshJson1.data?.user?.hasPassword === false &&
        Array.isArray(refreshJson1.data?.user?.authProviders) &&
        refreshJson1.data.user.authProviders.includes("google"),
      `Refresh exchange failed: ${JSON.stringify(refreshJson1)}`,
    );
    let currentAccessToken = refreshJson1.data.accessToken as string;
    let currentRefreshCookie = extractCookieValue(getSetCookieHeaders(refreshRes1), "refreshToken")!;
    assert(currentRefreshCookie, "Expected rotated refreshToken cookie after exchange");

    const meRes = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${currentAccessToken}` },
    });
    const meJson = await meRes.json();
    assert(
      meRes.status === 200 && meJson.data?.email === newGoogleEmail && meJson.data?.hasPassword === false,
      `Expected /auth/me to succeed for Google user, got ${JSON.stringify(meJson)}`,
    );
    console.info("✓ New Google customer created, HTTP-only cookie minted, session exchanged cleanly");

    // [Test 5] Google Login for Existing Google User (No Duplicate User)
    console.info("\n[Test 5] Verifying repeat Google login returns same user with no duplicates...");
    const loginCode = `code-existing-google-${ts}`;
    scenarios.set(loginCode, {
      accessToken: `goog-provider-access-repeat-${ts}`,
      idToken: signGoogleIdToken({
        sub: newGoogleSub,
        email: newGoogleEmail,
        email_verified: true,
        name: "Mekdes Abebe",
        picture: newGoogleAvatar,
      }),
      profile: {
        provider: "google",
        id: newGoogleSub,
        displayName: "Mekdes Abebe",
      },
    });

    const repeatStart = await startGoogleFlow({ intent: "login" });
    const repeatCb = await fetch(
      `${baseUrl}/api/auth/google/callback?code=${loginCode}&state=${encodeURIComponent(repeatStart.state)}`,
      {
        redirect: "manual",
        headers: { Cookie: `ag_oauth_state=${repeatStart.stateCookie}` },
      },
    );
    const repeatLoc = new URL(repeatCb.headers.get("location")!);
    assert(
      repeatLoc.searchParams.get("status") === "success" &&
        repeatLoc.searchParams.get("isNewUser") === "false" &&
        repeatLoc.searchParams.get("linked") === "false",
      `Expected existing Google login params, got ${repeatLoc.toString()}`,
    );

    const matchingUsersCount = await prisma.user.count({ where: { email: newGoogleEmail } });
    const matchingOAuthCount = await prisma.oAuthAccount.count({
      where: { provider: "GOOGLE", providerAccountId: newGoogleSub },
    });
    assert(matchingUsersCount === 1 && matchingOAuthCount === 1, "Duplicate user or OAuth link created!");
    console.info("✓ Repeat Google login authenticated same customer with zero duplicates");

    // [Test 6] Existing Password Account Linking (Preserves Password & Orders)
    console.info("\n[Test 6] Testing secure linking to existing email/password account...");
    const pwEmail = `existing.pw.${ts}@example.com`;
    createdEmails.push(pwEmail);
    const pwRegRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Dawit Bekele",
        email: pwEmail,
        phone: "+251911223344",
        password: "OriginalPassword123!",
      }),
    });
    const pwRegJson = await pwRegRes.json();
    assert(pwRegRes.status === 201 && pwRegJson.data?.user?.id, "Password registration failed");
    const existingUserId = pwRegJson.data.user.id as string;

    const linkSub = `google-sub-link-${ts}`;
    const linkCode = `code-link-${ts}`;
    scenarios.set(linkCode, {
      accessToken: `goog-access-link-${ts}`,
      idToken: signGoogleIdToken({
        sub: linkSub,
        email: pwEmail,
        email_verified: true,
        name: "Dawit Bekele",
        picture: "https://lh3.googleusercontent.com/a/ACg8ocLinkedUserPhoto=s96-c",
      }),
      profile: {
        provider: "google",
        id: linkSub,
        displayName: "Dawit Bekele",
      },
    });

    const linkStart = await startGoogleFlow({ intent: "login" });
    const linkCb = await fetch(
      `${baseUrl}/api/auth/google/callback?code=${linkCode}&state=${encodeURIComponent(linkStart.state)}`,
      {
        redirect: "manual",
        headers: { Cookie: `ag_oauth_state=${linkStart.stateCookie}` },
      },
    );
    const linkLoc = new URL(linkCb.headers.get("location")!);
    assert(
      linkLoc.searchParams.get("status") === "success" &&
        linkLoc.searchParams.get("isNewUser") === "false" &&
        linkLoc.searchParams.get("linked") === "true",
      `Expected linked=true for existing password user, got ${linkLoc.toString()}`,
    );

    const linkedDbUser = await prisma.user.findUnique({
      where: { id: existingUserId },
      include: { oauthAccounts: true },
    });
    assert(linkedDbUser?.passwordHash, "Existing passwordHash was cleared during Google linking!");
    assert(
      linkedDbUser.oauthAccounts.some((a) => a.provider === "GOOGLE" && a.providerAccountId === linkSub),
      "Expected linked Google OAuthAccount on existing password user",
    );

    // Existing email/password login still succeeds cleanly!
    const classicLoginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: pwEmail, password: "OriginalPassword123!" }),
    });
    const classicLoginJson = await classicLoginRes.json();
    assert(
      classicLoginRes.status === 200 &&
        classicLoginJson.data?.user?.id === existingUserId &&
        classicLoginJson.data?.user?.hasPassword === true &&
        classicLoginJson.data?.user?.authProviders?.includes("password") &&
        classicLoginJson.data?.user?.authProviders?.includes("google"),
      `Password login after linking failed: ${JSON.stringify(classicLoginJson)}`,
    );
    console.info("✓ Verified email/password account linked to Google without losing password login");

    // [Test 7] Prevent account hijack/conflict & duplicate classic registration
    console.info("\n[Test 7] Preventing Google sub conflict & duplicate email registration...");
    const hijackCode = `code-hijack-${ts}`;
    scenarios.set(hijackCode, {
      accessToken: `goog-access-hijack-${ts}`,
      idToken: signGoogleIdToken({
        sub: `different-google-sub-${ts}`,
        email: pwEmail,
        email_verified: true,
        name: "Impostor Account",
      }),
      profile: {
        provider: "google",
        id: `different-google-sub-${ts}`,
        displayName: "Impostor Account",
      },
    });
    const hijackStart = await startGoogleFlow({ intent: "login" });
    const hijackCb = await fetch(
      `${baseUrl}/api/auth/google/callback?code=${hijackCode}&state=${encodeURIComponent(hijackStart.state)}`,
      {
        redirect: "manual",
        headers: { Cookie: `ag_oauth_state=${hijackStart.stateCookie}` },
      },
    );
    const hijackLoc = new URL(hijackCb.headers.get("location")!);
    assert(
      hijackLoc.searchParams.get("status") === "error" &&
        hijackLoc.searchParams.get("error") === "OAUTH_ACCOUNT_CONFLICT",
      `Expected OAUTH_ACCOUNT_CONFLICT when another Google sub claims linked email, got ${hijackLoc.toString()}`,
    );

    const dupClassicReg = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Duplicate Attempt",
        email: newGoogleEmail,
        password: "AnotherPassword123!",
      }),
    });
    assert(dupClassicReg.status === 409, "Expected 409 conflict registering duplicate Google email");
    console.info("✓ Account conflict & duplicate registration blocked cleanly");

    // [Test 8] Google-only user can optionally set a password & then log out / persist session
    console.info("\n[Test 8] Testing session persistence on refresh, first-password setup & logout...");
    const setPwRes = await fetch(`${baseUrl}/api/v1/auth/change-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${currentAccessToken}`,
      },
      body: JSON.stringify({ newPassword: "NewAddedPassword123!" }),
    });
    const setPwJson = await setPwRes.json();
    assert(
      setPwRes.status === 200 && setPwJson.data?.changed === true && setPwJson.data?.accessToken,
      `Google user setting initial password failed: ${JSON.stringify(setPwJson)}`,
    );
    currentAccessToken = setPwJson.data.accessToken as string;
    currentRefreshCookie = extractCookieValue(getSetCookieHeaders(setPwRes), "refreshToken")!;

    // Simulate browser refresh: silent /auth/refresh-token via HTTP-only cookie
    const reloadRefreshRes = await fetch(`${baseUrl}/api/v1/auth/refresh-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `refreshToken=${currentRefreshCookie}`,
      },
    });
    const reloadRefreshJson = await reloadRefreshRes.json();
    assert(
      reloadRefreshRes.status === 200 &&
        reloadRefreshJson.data?.user?.hasPassword === true &&
        reloadRefreshJson.data?.user?.authProviders?.includes("google"),
      "Session persistence after refresh failed",
    );
    currentAccessToken = reloadRefreshJson.data.accessToken as string;
    currentRefreshCookie = extractCookieValue(
      getSetCookieHeaders(reloadRefreshRes),
      "refreshToken",
    )!;

    // Logout & verify token revocation
    const logoutRes = await fetch(`${baseUrl}/api/v1/auth/logout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${currentAccessToken}`,
        Cookie: `refreshToken=${currentRefreshCookie}`,
      },
    });
    assert(logoutRes.status === 200, "Logout failed");

    const postLogoutRefresh = await fetch(`${baseUrl}/api/v1/auth/refresh-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `refreshToken=${currentRefreshCookie}`,
      },
    });
    assert(
      postLogoutRefresh.status === 401,
      `Expected 401 on refresh after logout, got ${postLogoutRefresh.status}`,
    );
    console.info("✓ Passwordless account setup, session persistence & logout revocation verified");

    // [Test 9] Suspended / Deactivated user handling
    console.info("\n[Test 9] Blocking suspended/deactivated user during Google OAuth...");
    await prisma.user.update({
      where: { id: dbNewUser.id },
      data: { isActive: false },
    });

    const suspendedCode = `code-suspended-${ts}`;
    scenarios.set(suspendedCode, {
      accessToken: `goog-access-suspended-${ts}`,
      idToken: signGoogleIdToken({
        sub: newGoogleSub,
        email: newGoogleEmail,
        email_verified: true,
        name: "Mekdes Abebe",
      }),
      profile: {
        provider: "google",
        id: newGoogleSub,
        displayName: "Mekdes Abebe",
      },
    });
    const suspendedStart = await startGoogleFlow({ intent: "login" });
    const suspendedCb = await fetch(
      `${baseUrl}/api/auth/google/callback?code=${suspendedCode}&state=${encodeURIComponent(suspendedStart.state)}`,
      {
        redirect: "manual",
        headers: { Cookie: `ag_oauth_state=${suspendedStart.stateCookie}` },
      },
    );
    const suspendedLoc = new URL(suspendedCb.headers.get("location")!);
    const suspendedRefresh = extractCookieValue(getSetCookieHeaders(suspendedCb), "refreshToken");
    assert(
      suspendedLoc.searchParams.get("status") === "error" &&
        suspendedLoc.searchParams.get("error") === "ACCOUNT_DEACTIVATED",
      `Expected ACCOUNT_DEACTIVATED redirect, got ${suspendedLoc.toString()}`,
    );
    assert(!suspendedRefresh, "Suspended user must NOT receive a refreshToken cookie");
    console.info("✓ Suspended user strictly rejected during Google OAuth login");

    console.info("\n=========================================================================");
    console.info("=== ALL 9 GOOGLE OAUTH 2.0 E2E SCENARIOS PASSED SUCCESSFULLY!         ===");
    console.info("=========================================================================");
  } finally {
    OAuth2Client.prototype.getFederatedSignonCertsAsync = origGetFederatedSignonCertsAsync;

    // Clean up ephemeral test records
    if (createdEmails.length > 0) {
      const usersToDelete = await prisma.user.findMany({
        where: { email: { in: createdEmails } },
        select: { id: true },
      });
      const userIds = usersToDelete.map((u) => u.id);
      if (userIds.length > 0) {
        await prisma.notification.deleteMany({
          where: { relatedEntityType: "customer", relatedEntityId: { in: userIds } },
        });
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      }
    }

    // Restore original process env
    for (const [k, v] of Object.entries(originalEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }

    await prisma.$disconnect();
    server.close();
  }
}

runGoogleOAuthE2E().catch(async (err) => {
  console.error("\n❌ Google OAuth E2E Suite Failed:", err);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});

