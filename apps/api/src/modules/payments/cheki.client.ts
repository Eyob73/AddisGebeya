import { env } from "../../config/env.js";

export interface ChekiBankFormat {
  id: string;
  status: string;
  label: string;
  inputs: string[];
  accountDigits?: number;
  responseType?: string;
  supported: boolean;
  confidence?: string;
}

export interface ChekiBankMetadata {
  id: string;
  name: string;
  swift?: string;
  type: string;
  status: string;
  beta?: boolean;
  requiresAccount?: boolean;
  accountDigits?: number;
  requiresPhone?: boolean;
  endpoint?: string;
  color?: string;
  initials?: string;
  formats?: ChekiBankFormat[];
}

export interface ChekiHealthBankItem {
  id: string;
  name: string;
  status: "reachable" | "unreachable" | "geo-blocked" | "no-parser" | "in-development" | string;
  latencyMs: number;
}

export interface ChekiVerifyRequest {
  bank?: string;
  reference?: string;
  accountNumber?: string;
  qrData?: string;
  phoneNumber?: string;
}

export interface ChekiVerifySuccessPayload {
  success: boolean;
  verified: boolean;
  decodedOnly?: boolean;
  parsed?: boolean;
  bank?: string;
  bankCode?: string;
  cached?: boolean;
  reference?: string;
  senderName?: string;
  senderAccount?: string;
  receiverName?: string;
  receiverAccount?: string;
  amount?: number;
  currency?: string;
  date?: string;
  reason?: string;
  sourceUrl?: string;
  durationMs?: number;
  error?: string;
  fallbackUrl?: string;
  checkedUrl?: string;
}

export type ChekiVerifyOutcome =
  | {
      outcome: "ok";
      httpStatus: 200;
      data: ChekiVerifySuccessPayload;
    }
  | {
      outcome: "rejected";
      httpStatus: number;
      error: string;
      checkedUrl?: string;
    }
  | {
      outcome: "rate_limited";
      httpStatus: 429;
      retryAfterSeconds: number;
      error: string;
    }
  | {
      outcome: "unavailable";
      httpStatus: number;
      error: string;
      fallbackUrl?: string;
    };

export interface ChekiClientAdapter {
  getBanks(forceRefresh?: boolean): Promise<ChekiBankMetadata[]>;
  getHealth(forceRefresh?: boolean): Promise<ChekiHealthBankItem[]>;
  verifyReceipt(payload: ChekiVerifyRequest): Promise<ChekiVerifyOutcome>;
}

const CACHE_TTL_MS = 5 * 60 * 1000;

export class ChekiClient implements ChekiClientAdapter {
  private cachedBanks: { data: ChekiBankMetadata[]; expiresAt: number } | null = null;
  private cachedHealth: { data: ChekiHealthBankItem[]; expiresAt: number } | null = null;

  constructor(
    private readonly baseUrl: string = env.chekiApiBaseUrl,
    private readonly timeoutMs: number = env.chekiTimeoutMs,
  ) {}

  async getBanks(forceRefresh = false): Promise<ChekiBankMetadata[]> {
    const now = Date.now();
    if (!forceRefresh && this.cachedBanks && this.cachedBanks.expiresAt > now) {
      return this.cachedBanks.data;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/banks`, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(Math.min(this.timeoutMs, 15000)),
      });

      if (!response.ok) {
        throw new Error(`Cheki /api/banks returned HTTP ${response.status}`);
      }

      const json = (await response.json()) as { banks?: ChekiBankMetadata[] };
      const banks = Array.isArray(json.banks) ? json.banks : [];
      if (banks.length > 0) {
        this.cachedBanks = { data: banks, expiresAt: now + CACHE_TTL_MS };
      }
      return banks;
    } catch (err) {
      if (this.cachedBanks) {
        return this.cachedBanks.data;
      }
      throw err;
    }
  }

  async getHealth(forceRefresh = false): Promise<ChekiHealthBankItem[]> {
    const now = Date.now();
    if (!forceRefresh && this.cachedHealth && this.cachedHealth.expiresAt > now) {
      return this.cachedHealth.data;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/health`, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(Math.min(this.timeoutMs, 12000)),
      });

      if (!response.ok) {
        throw new Error(`Cheki /api/health returned HTTP ${response.status}`);
      }

      const json = (await response.json()) as { banks?: ChekiHealthBankItem[] };
      const banks = Array.isArray(json.banks) ? json.banks : [];
      if (banks.length > 0) {
        this.cachedHealth = { data: banks, expiresAt: now + CACHE_TTL_MS };
      }
      return banks;
    } catch {
      return this.cachedHealth?.data ?? [];
    }
  }

  async verifyReceipt(payload: ChekiVerifyRequest): Promise<ChekiVerifyOutcome> {
    try {
      const body: Record<string, string> = {};
      if (payload.bank) body.bank = payload.bank;
      if (payload.reference) body.reference = payload.reference;
      if (payload.accountNumber) body.accountNumber = payload.accountNumber;
      if (payload.qrData) body.qrData = payload.qrData;
      if (payload.phoneNumber) body.phoneNumber = payload.phoneNumber;

      const response = await fetch(`${this.baseUrl}/api/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      let json: ChekiVerifySuccessPayload | Record<string, unknown> = {};
      try {
        json = (await response.json()) as ChekiVerifySuccessPayload;
      } catch {
        json = {};
      }

      if (response.status === 200) {
        return {
          outcome: "ok",
          httpStatus: 200,
          data: json as ChekiVerifySuccessPayload,
        };
      }

      if (response.status === 429) {
        const retryHeader = Number(response.headers.get("retry-after") ?? "30");
        const retryAfterSeconds = Number.isFinite(retryHeader) && retryHeader > 0 ? retryHeader : 30;
        return {
          outcome: "rate_limited",
          httpStatus: 429,
          retryAfterSeconds,
          error:
            typeof json.error === "string"
              ? json.error
              : "Verification rate limit exceeded. Please try again shortly.",
        };
      }

      if (response.status === 400 || response.status === 404 || response.status === 413 || response.status === 422) {
        return {
          outcome: "rejected",
          httpStatus: response.status,
          error:
            typeof json.error === "string"
              ? json.error
              : "Receipt could not be verified with the bank.",
          checkedUrl: typeof json.checkedUrl === "string" ? json.checkedUrl : undefined,
        };
      }

      return {
        outcome: "unavailable",
        httpStatus: response.status,
        error:
          typeof json.error === "string"
            ? json.error
            : `Payment verification gateway returned status ${response.status}.`,
        fallbackUrl: typeof json.fallbackUrl === "string" ? json.fallbackUrl : undefined,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network timeout contacting Cheki API";
      return {
        outcome: "unavailable",
        httpStatus: 503,
        error: msg,
      };
    }
  }
}

export const chekiClient = new ChekiClient();

