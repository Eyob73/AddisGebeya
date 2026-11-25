import type { NextFunction, Request, Response } from "express";
import { HTTP_STATUS } from "@addisgebeya/shared";
import { prisma } from "../config/database.js";
import { AppError } from "../utils/app-error.js";
import { verifyAccessToken } from "../utils/jwt.js";

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }
  return token;
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = extractBearerToken(req);
  if (!token) {
    return next();
  }

  try {
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, isActive: true },
    });

    if (user && user.isActive) {
      req.user = {
        id: user.id,
        email: user.email,
        role: user.role as "CUSTOMER" | "ADMIN",
      };
    }
  } catch {
    // Optional auth ignores invalid token
  }

  next();
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = extractBearerToken(req);
  if (!token) {
    return next(
      new AppError({
        message: "Authentication required",
        statusCode: HTTP_STATUS.UNAUTHORIZED,
        code: "UNAUTHORIZED",
      }),
    );
  }

  try {
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return next(
        new AppError({
          message: "User account not found or deactivated",
          statusCode: HTTP_STATUS.UNAUTHORIZED,
          code: "ACCOUNT_DEACTIVATED",
        }),
      );
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role as "CUSTOMER" | "ADMIN",
    };
    next();
  } catch {
    next(
      new AppError({
        message: "Invalid or expired access token",
        statusCode: HTTP_STATUS.UNAUTHORIZED,
        code: "INVALID_TOKEN",
      }),
    );
  }
}

export function requireRole(role: "ADMIN" | "CUSTOMER") {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(
        new AppError({
          message: "Authentication required",
          statusCode: HTTP_STATUS.UNAUTHORIZED,
          code: "UNAUTHORIZED",
        }),
      );
    }

    if (req.user.role !== role) {
      return next(
        new AppError({
          message: "Insufficient permissions",
          statusCode: HTTP_STATUS.FORBIDDEN,
          code: "FORBIDDEN",
        }),
      );
    }

    next();
  };
}

