export const OFFICIAL_RECEIPT_ALLOWED_HOSTS: Record<string, readonly string[]> = {
  telebirr: ["transactioninfo.ethiotelecom.et"],
  cbe: ["mbreciept.cbe.com.et", "mbreceipt.cbe.com.et", "apps.cbe.com.et"],
};

export interface OfficialReceiptResolution {
  officialReceiptUrl: string | null;
  cbeReceiptToken: string | null;
  isValid: boolean;
  reason?: string;
}

const PLACEHOLDER_REF_PREFIXES = ["REF-", "PENDING-", "RCP-"];

export function isPlaceholderTransactionReference(value?: string | null): boolean {
  if (!value) return true;
  const trimmed = value.trim().toUpperCase();
  if (!trimmed) return true;
  return PLACEHOLDER_REF_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
}

export function normalizeReceiptProviderCode(provider?: string | null): string {
  const code = (provider || "").trim().toLowerCase();
  if (code === "cbe-new") return "cbe";
  if (code === "bank_transfer") return "cbe";
  return code;
}

/**
 * Checks whether a value looks like an authentic CBE receipt token
 * (such as "v2-hfHCxHBTw7FA4RR1DP0b") rather than a bare FT transaction reference.
 */
export function isPlausibleCbeReceiptToken(rawToken?: string | null): boolean {
  if (!rawToken) return false;
  const token = rawToken.trim().replace(/^\/+/, "");
  if (!token || token.length < 8 || token.length > 128) return false;
  if (isPlaceholderTransactionReference(token)) return false;
  // Never confuse an FT transaction reference (e.g. FT2611...) with a CBE receipt token
  if (/^FT[A-Z0-9-]+$/i.test(token)) return false;
  // Must not contain whitespace or scheme/slashes
  if (/[\s/:?&#]/.test(token)) return false;
  return /^[A-Za-z0-9._~-]+$/.test(token);
}

/**
 * Checks whether a value looks like a real Telebirr transaction ID (e.g. DKG490262A).
 */
export function isValidTelebirrTransactionRef(rawRef?: string | null): boolean {
  if (!rawRef) return false;
  const trimmed = rawRef.trim();
  if (!trimmed || isPlaceholderTransactionReference(trimmed)) return false;
  // Internal sandbox initialization reference format TB-YYYYMMDD-NNNNN is not a Telebirr TX code
  if (/^TB-\d{8}-\d+$/i.test(trimmed)) return false;
  return /^[A-Za-z0-9_-]{6,36}$/.test(trimmed);
}

/**
 * Extracts a Telebirr transaction reference from either a full official Telebirr URL
 * or a plain transaction code string.
 */
export function extractTelebirrReference(rawInput?: string | null): string | null {
  if (!rawInput) return null;
  const trimmed = rawInput.trim();
  if (!trimmed) return null;

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      if (
        parsed.protocol === "https:" &&
        parsed.hostname.toLowerCase() === "transactioninfo.ethiotelecom.et"
      ) {
        const match = parsed.pathname.match(/^\/receipt\/([A-Za-z0-9_-]{6,36})\/?$/);
        if (match?.[1] && isValidTelebirrTransactionRef(match[1])) {
          return match[1];
        }
      }
    } catch {
      return null;
    }
    return null;
  }

  return isValidTelebirrTransactionRef(trimmed) ? trimmed : null;
}

/**
 * Extracts a CBE receipt token from an official mbreciept/mbreceipt.cbe.com.et URL
 * or validates a direct token string. Never converts FT references into tokens.
 */
export function extractCbeReceiptToken(rawInput?: string | null): string | null {
  if (!rawInput) return null;
  const trimmed = rawInput.trim();
  if (!trimmed) return null;

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      const host = parsed.hostname.toLowerCase();
      if (
        parsed.protocol === "https:" &&
        (host === "mbreciept.cbe.com.et" || host === "mbreceipt.cbe.com.et")
      ) {
        const pathToken = parsed.pathname.replace(/^\/+|\/+$/g, "");
        if (isPlausibleCbeReceiptToken(pathToken)) {
          return pathToken;
        }
      }
    } catch {
      return null;
    }
    return null;
  }

  return isPlausibleCbeReceiptToken(trimmed) ? trimmed : null;
}

/**
 * Strictly validates that a receipt URL uses HTTPS and belongs to an allowlisted
 * official hostname for the expected payment provider.
 */
export function validateOfficialReceiptUrl(
  provider?: string | null,
  rawUrl?: string | null,
): string | null {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  const normalizedProvider = normalizeReceiptProviderCode(provider);
  const allowedHosts = OFFICIAL_RECEIPT_ALLOWED_HOSTS[normalizedProvider];
  if (!allowedHosts || allowedHosts.length === 0) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    return null;
  }

  const host = parsed.hostname.toLowerCase();
  if (!allowedHosts.includes(host)) {
    return null;
  }

  if (normalizedProvider === "telebirr") {
    const refMatch = parsed.pathname.match(/^\/receipt\/([A-Za-z0-9_-]{6,36})\/?$/);
    if (!refMatch?.[1] || !isValidTelebirrTransactionRef(refMatch[1])) {
      return null;
    }
    return `https://transactioninfo.ethiotelecom.et/receipt/${encodeURIComponent(refMatch[1])}`;
  }

  if (normalizedProvider === "cbe") {
    if (host === "mbreciept.cbe.com.et" || host === "mbreceipt.cbe.com.et") {
      const token = parsed.pathname.replace(/^\/+|\/+$/g, "");
      if (!isPlausibleCbeReceiptToken(token)) {
        return null;
      }
      return `https://${host}/${encodeURIComponent(token)}`;
    }
    if (host === "apps.cbe.com.et") {
      if (!parsed.searchParams.get("id")?.trim() && parsed.pathname.length < 3) {
        return null;
      }
      return parsed.toString();
    }
  }

  return null;
}

/**
 * Resolves the safe official provider receipt webpage URL & CBE token (when applicable)
 * strictly according to provider rules. Never invents CBE tokens from transaction numbers.
 */
export function resolveOfficialReceiptLink(input: {
  provider?: string | null;
  transactionReference?: string | null;
  verifiedReference?: string | null;
  extractedReference?: string | null;
  officialReceiptUrl?: string | null;
  sourceUrl?: string | null;
  cbeReceiptToken?: string | null;
  qrData?: string | null;
}): OfficialReceiptResolution {
  const provider = normalizeReceiptProviderCode(input.provider);

  if (provider === "telebirr") {
    const urlCandidates = [
      input.officialReceiptUrl,
      input.sourceUrl,
      input.qrData,
      input.verifiedReference,
      input.transactionReference,
      input.extractedReference,
    ];
    for (const candidate of urlCandidates) {
      const validated = validateOfficialReceiptUrl("telebirr", candidate);
      if (validated) {
        return {
          officialReceiptUrl: validated,
          cbeReceiptToken: null,
          isValid: true,
        };
      }
    }

    const refCandidates = [
      input.verifiedReference,
      input.transactionReference,
      input.extractedReference,
    ];
    for (const candidate of refCandidates) {
      const ref = extractTelebirrReference(candidate);
      if (ref) {
        const constructed = `https://transactioninfo.ethiotelecom.et/receipt/${encodeURIComponent(ref)}`;
        return {
          officialReceiptUrl: constructed,
          cbeReceiptToken: null,
          isValid: true,
        };
      }
    }

    return {
      officialReceiptUrl: null,
      cbeReceiptToken: null,
      isValid: false,
      reason:
        "A valid Telebirr transaction reference is required before the official Telebirr receipt page can be opened.",
    };
  }

  if (provider === "cbe") {
    const urlCandidates = [
      input.officialReceiptUrl,
      input.sourceUrl,
      input.qrData,
      input.verifiedReference,
      input.transactionReference,
      input.extractedReference,
    ];
    for (const candidate of urlCandidates) {
      const validated = validateOfficialReceiptUrl("cbe", candidate);
      if (validated) {
        const token =
          extractCbeReceiptToken(validated) ??
          (isPlausibleCbeReceiptToken(input.cbeReceiptToken)
            ? input.cbeReceiptToken!.trim()
            : null);
        return {
          officialReceiptUrl: validated,
          cbeReceiptToken: token,
          isValid: true,
        };
      }
    }

    if (isPlausibleCbeReceiptToken(input.cbeReceiptToken)) {
      const cleanToken = input.cbeReceiptToken!.trim();
      const url = `https://mbreciept.cbe.com.et/${encodeURIComponent(cleanToken)}`;
      return {
        officialReceiptUrl: url,
        cbeReceiptToken: cleanToken,
        isValid: true,
      };
    }

    return {
      officialReceiptUrl: null,
      cbeReceiptToken: null,
      isValid: false,
      reason:
        "Official CBE receipt link unavailable: CBE receipt URLs require an authentic receipt token or official URL supplied during confirmation or QR scan, not only a transaction reference.",
    };
  }

  return {
    officialReceiptUrl: null,
    cbeReceiptToken: null,
    isValid: false,
    reason:
      "Official provider receipt webpage links are currently supported for Telebirr and CBE.",
  };
}

