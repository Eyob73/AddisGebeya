import type { Socket } from "socket.io";
import { prisma } from "../config/database.js";
import { verifyAccessToken } from "../utils/jwt.js";
import { logger } from "../utils/logger.js";
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from "./socket.events.js";

type AuthenticatedSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

interface SocketAuthError extends Error {
  data?: {
    code: string;
    message: string;
  };
}

function createSocketAuthError(code: string, message: string): SocketAuthError {
  const err = new Error(message) as SocketAuthError;
  err.data = { code, message };
  return err;
}

function extractSocketAccessToken(socket: AuthenticatedSocket): string | null {
  const authToken = socket.handshake.auth?.token;
  if (typeof authToken === "string" && authToken.trim()) {
    const trimmed = authToken.trim();
    if (trimmed.toLowerCase().startsWith("bearer ")) {
      return trimmed.slice(7).trim() || null;
    }
    return trimmed;
  }

  const headerAuth = socket.handshake.headers?.authorization;
  if (typeof headerAuth === "string" && headerAuth.trim()) {
    const [scheme, token] = headerAuth.trim().split(/\s+/);
    if (scheme?.toLowerCase() === "bearer" && token) {
      return token;
    }
  }

  return null;
}

export async function authenticateSocket(
  socket: AuthenticatedSocket,
  next: (err?: Error) => void,
): Promise<void> {
  const token = extractSocketAccessToken(socket);
  if (!token) {
    logger.warn("Socket connection rejected: missing access token", {
      socketId: socket.id,
      ip: socket.handshake.address,
    });
    next(createSocketAuthError("UNAUTHORIZED", "Authentication required"));
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    if (!payload.sub) {
      next(createSocketAuthError("INVALID_TOKEN", "Invalid access token payload"));
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        fullName: true,
      },
    });

    if (!user || !user.isActive) {
      logger.warn("Socket connection rejected: user inactive or missing", {
        socketId: socket.id,
        userId: payload.sub,
      });
      next(createSocketAuthError("ACCOUNT_DEACTIVATED", "User account not found or deactivated"));
      return;
    }

    // Strictly derive identity & role from PostgreSQL record, never from client handshake
    socket.data.user = {
      id: user.id,
      email: user.email,
      role: user.role === "ADMIN" ? "ADMIN" : "CUSTOMER",
      fullName: user.fullName,
    };

    next();
  } catch (error) {
    logger.warn("Socket connection rejected: invalid or expired token", {
      socketId: socket.id,
      error: error instanceof Error ? error.message : String(error),
    });
    next(createSocketAuthError("INVALID_TOKEN", "Invalid or expired access token"));
  }
}

