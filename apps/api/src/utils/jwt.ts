import crypto from "node:crypto";
import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";
import { HTTP_STATUS } from "@addisgebeya/shared";
import { env } from "../config/env.js";
import { AppError } from "./app-error.js";

export interface AuthTokenPayload extends JwtPayload {
  sub: string;
  role?: string;
}

function requireSecret(secret: string, name: string): string {
  if (!secret) {
    throw new AppError({
      message: `${name} is not configured`,
      statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      code: "JWT_CONFIG_ERROR",
      isOperational: false,
    });
  }
  return secret;
}

export function signAccessToken(
  payload: Omit<AuthTokenPayload, "iat" | "exp">,
  expiresIn: SignOptions["expiresIn"] = "15m",
): string {
  const secret = requireSecret(env.jwtAccessSecret, "JWT_ACCESS_SECRET");
  return jwt.sign(
    {
      ...payload,
      jti: crypto.randomUUID(),
    },
    secret,
    { expiresIn },
  );
}

export function signRefreshToken(
  payload: Omit<AuthTokenPayload, "iat" | "exp">,
  expiresIn: SignOptions["expiresIn"] = "7d",
): string {
  const secret = requireSecret(env.jwtRefreshSecret, "JWT_REFRESH_SECRET");
  return jwt.sign(
    {
      ...payload,
      jti: crypto.randomUUID(),
    },
    secret,
    { expiresIn },
  );
}

export function verifyAccessToken(token: string): AuthTokenPayload {
  const secret = requireSecret(env.jwtAccessSecret, "JWT_ACCESS_SECRET");
  return jwt.verify(token, secret) as AuthTokenPayload;
}

export function verifyRefreshToken(token: string): AuthTokenPayload {
  const secret = requireSecret(env.jwtRefreshSecret, "JWT_REFRESH_SECRET");
  return jwt.verify(token, secret) as AuthTokenPayload;
}

export interface ReceiptViewTokenPayload extends JwtPayload {
  sub: string;
  role: "CUSTOMER" | "ADMIN";
  receiptId: string;
  purpose: "receipt_view";
}

export function signReceiptAccessToken(
  payload: { sub: string; role: "CUSTOMER" | "ADMIN"; receiptId: string },
  expiresIn: SignOptions["expiresIn"] = "5m",
): string {
  const secret = requireSecret(env.jwtAccessSecret, "JWT_ACCESS_SECRET");
  return jwt.sign(
    {
      sub: payload.sub,
      role: payload.role,
      receiptId: payload.receiptId,
      purpose: "receipt_view",
      jti: crypto.randomUUID(),
    },
    secret,
    { expiresIn },
  );
}

export function verifyReceiptAccessToken(token: string): ReceiptViewTokenPayload {
  const secret = requireSecret(env.jwtAccessSecret, "JWT_ACCESS_SECRET");
  try {
    const decoded = jwt.verify(token, secret) as Partial<ReceiptViewTokenPayload>;
    if (
      decoded.purpose !== "receipt_view" ||
      !decoded.sub ||
      !decoded.receiptId ||
      (decoded.role !== "ADMIN" && decoded.role !== "CUSTOMER")
    ) {
      throw new AppError({
        message: "Invalid receipt access link.",
        statusCode: HTTP_STATUS.UNAUTHORIZED,
        code: "INVALID_RECEIPT_ACCESS_TOKEN",
      });
    }
    return decoded as ReceiptViewTokenPayload;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError({
      message: "Receipt access link is invalid or has expired. Please reopen the receipt.",
      statusCode: HTTP_STATUS.UNAUTHORIZED,
      code: "INVALID_RECEIPT_ACCESS_TOKEN",
    });
  }
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

