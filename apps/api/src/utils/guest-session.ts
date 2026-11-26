import crypto from "node:crypto";
import type { CookieOptions, Request, Response } from "express";
import { env } from "../config/env.js";

export const GUEST_SESSION_COOKIE_NAME = "ag_guest_session";
const GUEST_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
const UUID_V4_LIKE_REGEX = /^[a-zA-Z0-9_-]{12,128}$/;

function getGuestSigningKey(): Buffer {
  const secret = env.jwtAccessSecret || env.jwtRefreshSecret || "addisgebeya-dev-guest-secret";
  return crypto
    .createHmac("sha256", secret)
    .update("addisgebeya-guest-session-v1")
    .digest();
}

export function getGuestCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    maxAge: GUEST_SESSION_TTL_SECONDS * 1000,
    path: "/api",
  };
}

export function signGuestSessionToken(guestId: string): string {
  const payload = {
    gid: guestId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + GUEST_SESSION_TTL_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = crypto
    .createHmac("sha256", getGuestSigningKey())
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${sig}`;
}

export function verifyGuestSessionToken(token: string | undefined | null): string | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;

  const [encoded, sig] = parts;
  const expectedSig = crypto
    .createHmac("sha256", getGuestSigningKey())
    .update(encoded)
    .digest("base64url");

  const sigBuf = Buffer.from(sig, "utf8");
  const expectedBuf = Buffer.from(expectedSig, "utf8");
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as {
      gid?: unknown;
      exp?: unknown;
    };
    if (
      typeof decoded.gid !== "string" ||
      !UUID_V4_LIKE_REGEX.test(decoded.gid) ||
      typeof decoded.exp !== "number" ||
      decoded.exp < Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return decoded.gid;
  } catch {
    return null;
  }
}

/**
 * Extracts a cryptographically verified guest session ID from HTTP-only cookies.
 * Used for guest order confirmation & guest payment/receipt authorization.
 */
export function getVerifiedGuestSessionId(req: Request): string | null {
  const cookieToken =
    typeof req.cookies?.[GUEST_SESSION_COOKIE_NAME] === "string"
      ? req.cookies[GUEST_SESSION_COOKIE_NAME]
      : undefined;
  return verifyGuestSessionToken(cookieToken);
}

/**
 * Returns an existing verified guest session ID or mints a new signed HTTP-only cookie.
 */
export function getOrCreateGuestSessionId(req: Request, res: Response): string {
  const existing = getVerifiedGuestSessionId(req);
  if (existing) {
    return existing;
  }

  const nextId = crypto.randomUUID();
  const signedToken = signGuestSessionToken(nextId);
  res.cookie(GUEST_SESSION_COOKIE_NAME, signedToken, getGuestCookieOptions());
  return nextId;
}

/**
 * Resolves guest cart identifier for unauthenticated cart operations.
 * Prefers signed HTTP-only cookie, falling back cleanly to validated x-guest-id header.
 */
export function resolveGuestCartId(req: Request, res?: Response, createIfMissing = false): string | null {
  const cookieGuestId = getVerifiedGuestSessionId(req);
  if (cookieGuestId) {
    return cookieGuestId;
  }

  const headerGuestId = typeof req.headers["x-guest-id"] === "string" ? req.headers["x-guest-id"].trim() : "";
  if (headerGuestId && UUID_V4_LIKE_REGEX.test(headerGuestId)) {
    return `hdr_${headerGuestId}`;
  }

  if (createIfMissing && res) {
    return getOrCreateGuestSessionId(req, res);
  }

  return null;
}

