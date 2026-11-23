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
  return jwt.sign(payload, secret, { expiresIn });
}

export function signRefreshToken(
  payload: Omit<AuthTokenPayload, "iat" | "exp">,
  expiresIn: SignOptions["expiresIn"] = "7d",
): string {
  const secret = requireSecret(env.jwtRefreshSecret, "JWT_REFRESH_SECRET");
  return jwt.sign(payload, secret, { expiresIn });
}

export function verifyAccessToken(token: string): AuthTokenPayload {
  const secret = requireSecret(env.jwtAccessSecret, "JWT_ACCESS_SECRET");
  return jwt.verify(token, secret) as AuthTokenPayload;
}

export function verifyRefreshToken(token: string): AuthTokenPayload {
  const secret = requireSecret(env.jwtRefreshSecret, "JWT_REFRESH_SECRET");
  return jwt.verify(token, secret) as AuthTokenPayload;
}
