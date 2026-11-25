import type { ApiErrorResponse, ApiSuccessResponse } from "@addisgebeya/types";
import { clientEnv } from "./env";

export class ApiClientError extends Error {
  public readonly status: number;
  public readonly code: string;

  constructor(message: string, status: number, code = "API_ERROR") {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
  _retry?: boolean;
}

const TOKEN_KEY = "addisgebeya_access_token";

let inMemoryAccessToken: string | null = null;
let unauthorizedListeners: Array<() => void> = [];

export function onUnauthorized(listener: () => void): () => void {
  unauthorizedListeners.push(listener);
  return () => {
    unauthorizedListeners = unauthorizedListeners.filter((l) => l !== listener);
  };
}

function notifyUnauthorized(): void {
  for (const listener of unauthorizedListeners) {
    try {
      listener();
    } catch {
      // ignore
    }
  }
}

export function getStoredAccessToken(): string | null {
  if (inMemoryAccessToken) return inMemoryAccessToken;
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) inMemoryAccessToken = token;
  return token;
}

export function setStoredTokens(accessToken: string, _legacyRefreshToken?: string): void {
  inMemoryAccessToken = accessToken;
  if (typeof window !== "undefined") {
    localStorage.setItem(TOKEN_KEY, accessToken);
  }
}

export function clearStoredTokens(): void {
  inMemoryAccessToken = null;
  if (typeof window !== "undefined") {
    localStorage.removeItem(TOKEN_KEY);
  }
}

let refreshPromise: Promise<string | null> | null = null;

async function executeRefresh(): Promise<string | null> {
  const normalizedBase = clientEnv.apiUrl.replace(/\/+$/, "");
  try {
    const res = await fetch(`${normalizedBase}/auth/refresh-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include", // Sends HTTP-only refreshToken cookie
    });

    if (!res.ok) {
      clearStoredTokens();
      notifyUnauthorized();
      return null;
    }

    const payload = (await res.json().catch(() => null)) as
      | ApiSuccessResponse<{ accessToken: string }>
      | null;

    if (payload && payload.success && payload.data?.accessToken) {
      const newToken = payload.data.accessToken;
      setStoredTokens(newToken);
      return newToken;
    }

    clearStoredTokens();
    notifyUnauthorized();
    return null;
  } catch {
    clearStoredTokens();
    notifyUnauthorized();
    return null;
  } finally {
    refreshPromise = null;
  }
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, params, _retry, ...rest } = options;
  const normalizedBase = clientEnv.apiUrl.replace(/\/+$/, "");
  const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

  let url = `${normalizedBase}${normalizedEndpoint}`;

  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        searchParams.append(key, String(value));
      }
    }
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes("?") ? "&" : "?") + queryString;
    }
  }

  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const token = getStoredAccessToken();
  const authHeaders: Record<string, string> = {};
  if (token) {
    authHeaders["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...rest,
    credentials: "include",
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...authHeaders,
      ...headers,
    },
    body: isFormData ? (body as FormData) : body !== undefined ? JSON.stringify(body) : undefined,
  });

  const isAuthEndpoint =
    normalizedEndpoint.includes("/auth/login") ||
    normalizedEndpoint.includes("/auth/register") ||
    normalizedEndpoint.includes("/auth/refresh-token") ||
    normalizedEndpoint.includes("/auth/logout");

  // Handle 401 Unauthorized with silent refresh and concurrency queue
  if (response.status === 401 && !isAuthEndpoint && !_retry) {
    if (!refreshPromise) {
      refreshPromise = executeRefresh();
    }
    const newToken = await refreshPromise;
    if (newToken) {
      return request<T>(endpoint, {
        ...options,
        _retry: true,
      });
    }
  }

  const payload = (await response.json().catch(() => null)) as
    | ApiSuccessResponse<T>
    | ApiErrorResponse
    | null;

  if (!response.ok || !payload || !payload.success) {
    const errorPayload = payload && !payload.success ? payload : null;
    throw new ApiClientError(
      errorPayload?.message ?? `Request failed with status ${response.status}`,
      response.status,
      errorPayload?.code ?? "REQUEST_FAILED",
    );
  }

  return payload.data;
}

export const apiClient = {
  get<T>(endpoint: string, options?: Omit<RequestOptions, "method" | "body">): Promise<T> {
    return request<T>(endpoint, { ...options, method: "GET" });
  },

  post<T>(
    endpoint: string,
    body?: unknown,
    options?: Omit<RequestOptions, "method" | "body">,
  ): Promise<T> {
    return request<T>(endpoint, { ...options, method: "POST", body });
  },

  put<T>(
    endpoint: string,
    body?: unknown,
    options?: Omit<RequestOptions, "method" | "body">,
  ): Promise<T> {
    return request<T>(endpoint, { ...options, method: "PUT", body });
  },

  patch<T>(
    endpoint: string,
    body?: unknown,
    options?: Omit<RequestOptions, "method" | "body">,
  ): Promise<T> {
    return request<T>(endpoint, { ...options, method: "PATCH", body });
  },

  delete<T>(endpoint: string, options?: Omit<RequestOptions, "method" | "body">): Promise<T> {
    return request<T>(endpoint, { ...options, method: "DELETE" });
  },

  async fetchBlob(endpoint: string, _retry = false): Promise<Blob> {
    const normalizedBase = clientEnv.apiUrl.replace(/\/+$/, "");
    const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const url = `${normalizedBase}${normalizedEndpoint}`;

    const token = getStoredAccessToken();
    const authHeaders: Record<string, string> = {};
    if (token) {
      authHeaders["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: "GET",
      credentials: "include",
      headers: authHeaders,
    });

    if (response.status === 401 && !_retry) {
      if (!refreshPromise) {
        refreshPromise = executeRefresh();
      }
      const newToken = await refreshPromise;
      if (newToken) {
        return apiClient.fetchBlob(endpoint, true);
      }
    }

    if (!response.ok) {
      throw new ApiClientError(
        `Could not load protected resource (${response.status})`,
        response.status,
        "BLOB_FETCH_FAILED",
      );
    }

    return response.blob();
  },
};
