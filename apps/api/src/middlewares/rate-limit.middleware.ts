import type { NextFunction, Request, Response } from "express";
import { HTTP_STATUS } from "@addisgebeya/shared";

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
  message?: string;
}

interface BucketEntry {
  timestamps: number[];
}

const stores = new Map<string, Map<string, BucketEntry>>();

/** Sliding-window in-memory rate limiter keyed by authenticated user ID or client IP. */
export function createRateLimiter(options: RateLimitOptions) {
  const bucketMap = new Map<string, BucketEntry>();
  stores.set(options.keyPrefix, bucketMap);

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const cutoff = now - options.windowMs;
    const identity = req.user?.id || req.ip || req.socket.remoteAddress || "unknown";
    const key = `${options.keyPrefix}:${identity}`;

    const entry = bucketMap.get(key) ?? { timestamps: [] };
    entry.timestamps = entry.timestamps.filter((ts) => ts > cutoff);

    if (entry.timestamps.length >= options.maxRequests) {
      const oldestTs = entry.timestamps[0] ?? now;
      const retryAfterSec = Math.max(1, Math.ceil((oldestTs + options.windowMs - now) / 1000));

      res.setHeader("Retry-After", String(retryAfterSec));
      res.setHeader("X-RateLimit-Limit", String(options.maxRequests));
      res.setHeader("X-RateLimit-Remaining", "0");
      res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
        success: false,
        message:
          options.message ??
          `Too many verification requests. Please wait ${retryAfterSec} seconds before retrying.`,
        code: "RATE_LIMIT_EXCEEDED",
        retryAfterSeconds: retryAfterSec,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    entry.timestamps.push(now);
    bucketMap.set(key, entry);

    // Occasional cleanup to bound memory usage
    if (bucketMap.size > 2000) {
      for (const [k, v] of bucketMap.entries()) {
        if (v.timestamps.every((ts) => ts <= cutoff)) {
          bucketMap.delete(k);
        }
      }
    }

    res.setHeader("X-RateLimit-Limit", String(options.maxRequests));
    res.setHeader(
      "X-RateLimit-Remaining",
      String(Math.max(0, options.maxRequests - entry.timestamps.length)),
    );
    next();
  };
}

/** Clears all rate limit buckets (used by automated tests). */
export function clearRateLimitBuckets(keyPrefix?: string): void {
  if (keyPrefix) {
    stores.get(keyPrefix)?.clear();
    return;
  }
  for (const map of stores.values()) {
    map.clear();
  }
}

