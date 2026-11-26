import crypto from "node:crypto";
import type { GoogleOAuthIntent } from "@addisgebeya/types";
import {
  googleOAuthStatePayloadSchema,
  isSafeRedirectPath,
  type GoogleOAuthStatePayload,
} from "@addisgebeya/validation";
import { HTTP_STATUS, resolveUploadedAvatarUrl } from "@addisgebeya/shared";
import { OAuth2Client } from "google-auth-library";
import passport from "passport";
import {
  Strategy as GoogleStrategy,
  type GoogleCallbackParameters,
  type Profile,
  type VerifyCallback,
} from "passport-google-oauth20";
import { getAllowedOrigins } from "../../config/cors.js";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/app-error.js";
import { logger } from "../../utils/logger.js";

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  devRedirectUrl: string;
  prodRedirectUrl: string;
  nodeEnv: "development" | "test" | "production";
}

export interface VerifiedGoogleIdentity {
  googleId: string;
  email: string;
  emailVerified: boolean;
  fullName: string;
  avatarUrl?: string;
}

const DEFAULT_CALLBACK_PATH = "/auth/google/callback";
const OAUTH_STATE_TTL_SECONDS = 10 * 60;

let registeredSignature = "";
const oauthClientsById = new Map<string, OAuth2Client>();

export function getGoogleOAuthConfig(): GoogleOAuthConfig {
  const port = process.env.PORT?.trim() || String(env.port);
  const backendUrl = (process.env.BACKEND_URL?.trim() || env.backendUrl || `http://localhost:${port}`).replace(
    /\/+$/,
    "",
  );
  const rawNodeEnv = process.env.NODE_ENV?.trim();
  const nodeEnv: "development" | "test" | "production" =
    rawNodeEnv === "production" || rawNodeEnv === "test" || rawNodeEnv === "development"
      ? rawNodeEnv
      : env.nodeEnv;

  return {
    clientId: (process.env.GOOGLE_CLIENT_ID ?? env.googleClientId).trim(),
    clientSecret: (process.env.GOOGLE_CLIENT_SECRET ?? env.googleClientSecret).trim(),
    callbackUrl: (
      process.env.GOOGLE_CALLBACK_URL?.trim() ||
      env.googleCallbackUrl ||
      `${backendUrl}/api/auth/google/callback`
    ).trim(),
    devRedirectUrl: (
      process.env.GOOGLE_OAUTH_REDIRECT_URL_DEV?.trim() || env.googleOAuthRedirectUrlDev
    ).trim(),
    prodRedirectUrl: (
      process.env.GOOGLE_OAUTH_REDIRECT_URL_PROD?.trim() || env.googleOAuthRedirectUrlProd
    ).trim(),
    nodeEnv,
  };
}

export function isGoogleOAuthConfigured(): boolean {
  const cfg = getGoogleOAuthConfig();
  return Boolean(cfg.clientId && cfg.clientSecret && cfg.callbackUrl);
}

export function getGoogleOAuthClient(clientId?: string): OAuth2Client {
  const id = (clientId || getGoogleOAuthConfig().clientId).trim();
  if (!id) {
    throw new AppError({
      message: "Google OAuth client ID is not configured",
      statusCode: HTTP_STATUS.SERVICE_UNAVAILABLE,
      code: "GOOGLE_OAUTH_NOT_CONFIGURED",
    });
  }

  let client = oauthClientsById.get(id);
  if (!client) {
    client = new OAuth2Client(id);
    oauthClientsById.set(id, client);
  }
  return client;
}

export function resolveFrontendOAuthRedirectUrl(preferredOrigin?: string): string {
  const cfg = getGoogleOAuthConfig();
  const configuredAllowed = (process.env.FRONTEND_URL ?? "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  const allowedOrigins = configuredAllowed.length > 0 ? configuredAllowed : getAllowedOrigins();
  const normalizedPreferred = preferredOrigin?.trim().replace(/\/+$/, "");

  const explicitTarget = cfg.nodeEnv === "production" ? cfg.prodRedirectUrl : cfg.devRedirectUrl;
  let targetPath = DEFAULT_CALLBACK_PATH;

  if (explicitTarget) {
    try {
      const parsed = new URL(explicitTarget);
      if (parsed.pathname && parsed.pathname !== "/") {
        targetPath = parsed.pathname;
      }
      if (!normalizedPreferred || normalizedPreferred === parsed.origin) {
        return parsed.toString();
      }
      if (allowedOrigins.includes(normalizedPreferred)) {
        return `${normalizedPreferred}${targetPath}`;
      }
      return parsed.toString();
    } catch {
      // Fallback to allowedOrigins below if explicit redirect URL fails URL parsing
    }
  }

  if (normalizedPreferred && allowedOrigins.includes(normalizedPreferred)) {
    return `${normalizedPreferred}${targetPath}`;
  }

  const primaryOrigin = allowedOrigins[0] || "http://localhost:3000";
  return `${primaryOrigin}${targetPath}`;
}

function getStateSigningKey(): Buffer {
  const cfg = getGoogleOAuthConfig();
  const baseSecret =
    process.env.JWT_ACCESS_SECRET?.trim() ||
    env.jwtAccessSecret ||
    cfg.clientSecret;

  if (!baseSecret) {
    throw new AppError({
      message: "OAuth state signing key is not available",
      statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      code: "OAUTH_STATE_SECRET_MISSING",
      isOperational: false,
    });
  }

  return crypto
    .createHmac("sha256", baseSecret)
    .update("addisgebeya-google-oauth-state-v1")
    .digest();
}

export function createOAuthStateToken(input: {
  intent: GoogleOAuthIntent;
  from?: string;
  frontendOrigin: string;
}): { stateToken: string; nonce: string } {
  const nonce = crypto.randomBytes(24).toString("hex");
  const nowSec = Math.floor(Date.now() / 1000);
  const safeFrom = input.from && isSafeRedirectPath(input.from) ? input.from.trim() : undefined;

  const payload: GoogleOAuthStatePayload = {
    nonce,
    intent: input.intent,
    from: safeFrom,
    frontendOrigin: input.frontendOrigin,
    iat: nowSec,
    exp: nowSec + OAUTH_STATE_TTL_SECONDS,
  };

  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = crypto
    .createHmac("sha256", getStateSigningKey())
    .update(encoded)
    .digest("base64url");

  return {
    stateToken: `${encoded}.${signature}`,
    nonce,
  };
}

export function verifyOAuthStateToken(
  stateToken: string | undefined,
  cookieNonce: string | undefined,
): GoogleOAuthStatePayload {
  if (!stateToken || !cookieNonce) {
    throw new AppError({
      message: "Missing or expired OAuth state parameter. Please try signing in again.",
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: "INVALID_OAUTH_STATE",
    });
  }

  const parts = stateToken.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new AppError({
      message: "Malformed OAuth state parameter.",
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: "INVALID_OAUTH_STATE",
    });
  }

  const [encoded, signature] = parts;
  const expectedSig = crypto
    .createHmac("sha256", getStateSigningKey())
    .update(encoded)
    .digest("base64url");

  const sigBuf = Buffer.from(signature, "utf8");
  const expectedSigBuf = Buffer.from(expectedSig, "utf8");
  if (sigBuf.length !== expectedSigBuf.length || !crypto.timingSafeEqual(sigBuf, expectedSigBuf)) {
    throw new AppError({
      message: "OAuth state signature verification failed.",
      statusCode: HTTP_STATUS.UNAUTHORIZED,
      code: "INVALID_OAUTH_STATE",
    });
  }

  let rawJson: unknown;
  try {
    rawJson = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    throw new AppError({
      message: "OAuth state payload could not be decoded.",
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: "INVALID_OAUTH_STATE",
    });
  }

  const parsed = googleOAuthStatePayloadSchema.safeParse(rawJson);
  if (!parsed.success) {
    throw new AppError({
      message: "OAuth state payload validation failed.",
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: "INVALID_OAUTH_STATE",
    });
  }

  const payload = parsed.data;
  const nowSec = Math.floor(Date.now() / 1000);
  if (payload.exp < nowSec) {
    throw new AppError({
      message: "Your Google sign-in session expired. Please try again.",
      statusCode: HTTP_STATUS.UNAUTHORIZED,
      code: "EXPIRED_OAUTH_STATE",
    });
  }

  const payloadNonceBuf = Buffer.from(payload.nonce, "utf8");
  const cookieNonceBuf = Buffer.from(cookieNonce, "utf8");
  if (
    payloadNonceBuf.length !== cookieNonceBuf.length ||
    !crypto.timingSafeEqual(payloadNonceBuf, cookieNonceBuf)
  ) {
    throw new AppError({
      message: "OAuth CSRF validation failed. Please initiate Google sign-in again.",
      statusCode: HTTP_STATUS.UNAUTHORIZED,
      code: "INVALID_OAUTH_STATE",
    });
  }

  if (payload.from && !isSafeRedirectPath(payload.from)) {
    payload.from = undefined;
  }

  return payload;
}

function deriveSafeFullName(rawName: string | undefined, email: string): string {
  const cleaned = (rawName ?? "").replace(/\s+/g, " ").trim();
  if (cleaned.length >= 2) {
    return cleaned.slice(0, 120);
  }
  const emailLocal = email.split("@")[0]?.replace(/[._-]+/g, " ").trim() ?? "";
  if (emailLocal.length >= 2) {
    return emailLocal
      .split(" ")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
      .slice(0, 120);
  }
  return "AddisGebeya Customer";
}

export async function verifyGoogleIdToken(
  idToken: string | undefined,
  expectedClientId?: string,
  profile?: Profile,
): Promise<VerifiedGoogleIdentity> {
  const clientId = (expectedClientId || getGoogleOAuthConfig().clientId).trim();
  if (!clientId) {
    throw new AppError({
      message: "Google OAuth is not configured on the server.",
      statusCode: HTTP_STATUS.SERVICE_UNAVAILABLE,
      code: "GOOGLE_OAUTH_NOT_CONFIGURED",
    });
  }

  if (!idToken || typeof idToken !== "string") {
    throw new AppError({
      message: "Google did not return a verifiable OpenID identity token.",
      statusCode: HTTP_STATUS.UNAUTHORIZED,
      code: "MISSING_GOOGLE_ID_TOKEN",
    });
  }

  const oauthClient = getGoogleOAuthClient(clientId);
  let ticket;
  try {
    ticket = await oauthClient.verifyIdToken({
      idToken,
      audience: clientId,
    });
  } catch (err) {
    logger.warn("Google ID token cryptographic verification failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    throw new AppError({
      message: "Google identity token could not be verified.",
      statusCode: HTTP_STATUS.UNAUTHORIZED,
      code: "INVALID_GOOGLE_ID_TOKEN",
    });
  }

  const payload = ticket.getPayload();
  if (!payload || !payload.sub) {
    throw new AppError({
      message: "Google identity token is missing required subject claims.",
      statusCode: HTTP_STATUS.UNAUTHORIZED,
      code: "INVALID_GOOGLE_ID_TOKEN",
    });
  }

  if (profile?.id && profile.id !== payload.sub) {
    logger.warn("Google OAuth subject mismatch between profile and verified ID token", {
      tokenSub: payload.sub,
      profileId: profile.id,
    });
    throw new AppError({
      message: "Google identity verification mismatch detected.",
      statusCode: HTTP_STATUS.UNAUTHORIZED,
      code: "GOOGLE_IDENTITY_MISMATCH",
    });
  }

  const normalizedEmail = payload.email?.trim().toLowerCase();
  if (!normalizedEmail) {
    throw new AppError({
      message: "Google account did not share an email address.",
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: "GOOGLE_EMAIL_MISSING",
    });
  }

  if (payload.email_verified !== true) {
    throw new AppError({
      message: "Your Google email address must be verified before signing in.",
      statusCode: HTTP_STATUS.FORBIDDEN,
      code: "EMAIL_NOT_VERIFIED",
    });
  }

  const rawPicture = payload.picture ?? profile?.photos?.[0]?.value ?? undefined;
  const fullName = deriveSafeFullName(payload.name ?? profile?.displayName, normalizedEmail);

  return {
    googleId: payload.sub,
    email: normalizedEmail,
    emailVerified: true,
    fullName,
    avatarUrl: resolveUploadedAvatarUrl(rawPicture),
  };
}

export async function verifyGoogleOAuthResult(
  params: GoogleCallbackParameters | undefined,
  profile: Profile | undefined,
  expectedClientId?: string,
): Promise<VerifiedGoogleIdentity> {
  return verifyGoogleIdToken(params?.id_token, expectedClientId, profile);
}

export function configureGoogleOAuthStrategy(forceReconfigure = false): boolean {
  const cfg = getGoogleOAuthConfig();
  if (!cfg.clientId || !cfg.clientSecret || !cfg.callbackUrl) {
    return false;
  }

  const signature = `${cfg.clientId}:${cfg.clientSecret}:${cfg.callbackUrl}`;
  if (!forceReconfigure && registeredSignature === signature) {
    return true;
  }

  const strategy = new GoogleStrategy(
    {
      clientID: cfg.clientId,
      clientSecret: cfg.clientSecret,
      callbackURL: cfg.callbackUrl,
      scope: ["openid", "profile", "email"],
      state: false,
      passReqToCallback: false,
    },
    async (
      _googleAccessToken: string,
      _googleRefreshToken: string,
      params: GoogleCallbackParameters,
      profile: Profile,
      done: VerifyCallback,
    ) => {
      try {
        const verifiedIdentity = await verifyGoogleOAuthResult(params, profile, cfg.clientId);
        done(null, verifiedIdentity as unknown as Express.User);
      } catch (error) {
        done(error as Error);
      }
    },
  );

  passport.use("google", strategy);
  registeredSignature = signature;
  return true;
}

