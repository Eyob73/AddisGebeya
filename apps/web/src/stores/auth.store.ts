import { create } from "zustand";
import { resolveUploadedAvatarUrl } from "@addisgebeya/shared";
import type { GoogleOAuthIntent, GoogleOneTapAuthResponse } from "@addisgebeya/types";
import {
  apiClient,
  clearStoredTokens,
  getStoredAccessToken,
  onUnauthorized,
  setStoredTokens,
} from "@/lib/api-client";
import { useCartStore } from "@/stores/cart.store";
import { useNotificationStore } from "@/stores/notification.store";
import { useWishlistStore } from "@/stores/wishlist.store";
import type { AuthUser } from "@/types/store.types";

export const DEMO_CUSTOMER: AuthUser = {
  id: "cust-abebe",
  name: "Abebe Tadesse",
  email: "abebe.t@gmail.com",
  phone: "+251 911 234 567",
  role: "customer",
  preferredSize: 42,
  subCity: "Bole (Rwanda / Edna / Japan / Atlas)",
};

export const DEMO_OWNER: AuthUser = {
  id: "owner-kidus",
  name: "Kidus Assefa",
  email: "kidus@addisgebeyashoes.et",
  phone: "+251 911 234 567",
  role: "admin",
  preferredSize: 42,
  subCity: "Bole Medhanialem HQ",
};

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;

  initialize: () => Promise<void>;
  login: (email: string, password?: string) => Promise<AuthUser>;
  register: (payload: {
    name: string;
    email: string;
    phone: string;
    password?: string;
    preferredSize?: number;
    subCity?: string;
  }) => Promise<AuthUser>;
  loginWithGoogleOneTap: (
    credential: string,
    intent?: GoogleOAuthIntent,
  ) => Promise<GoogleOneTapAuthResponse>;
  completeGoogleAuth: () => Promise<AuthUser>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  deactivateAccount: (passwordConfirm: string) => Promise<void>;
  uploadAvatar: (avatarInput: string | File) => Promise<string | undefined>;
  updateProfile: (
    patch: Partial<Omit<AuthUser, "avatarUrl">> & { avatarUrl?: string | null },
  ) => Promise<AuthUser | null>;
  changePassword: (payload: { currentPassword?: string; newPassword: string }) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (payload: { token: string; newPassword: string }) => Promise<void>;
  refreshProfile: () => Promise<AuthUser | null>;
}

// Coalesce concurrent cookie refresh/exchange calls (StrictMode + AppProviders) to prevent false reuse revocation
let inFlightCookieSessionPromise: Promise<AuthUser> | null = null;
let lastCompletedCookieAuthAt = 0;

async function establishSessionFromRefreshCookie(): Promise<AuthUser> {
  if (inFlightCookieSessionPromise) {
    return inFlightCookieSessionPromise;
  }

  const current = useAuthStore.getState();
  if (
    current.isAuthenticated &&
    current.user &&
    Date.now() - lastCompletedCookieAuthAt < 5000
  ) {
    return current.user;
  }

  inFlightCookieSessionPromise = (async () => {
    const res = await apiClient.post<{ user: AuthUser; accessToken: string }>("/auth/refresh-token");
    if (!res?.accessToken || !res?.user) {
      throw new Error("Unable to establish your authenticated session.");
    }

    setStoredTokens(res.accessToken);
    const enrichedUser = await apiClient.get<AuthUser>("/auth/me").catch(() => res.user);
    lastCompletedCookieAuthAt = Date.now();

    useAuthStore.setState({
      user: enrichedUser,
      isAuthenticated: true,
      isLoading: false,
      isInitialized: true,
    });

    useWishlistStore.getState().syncFromBackend().catch(() => {});
    await useCartStore.getState().mergeWithBackend().catch(() => ({ warnings: [], mergedCount: 0 }));

    return enrichedUser;
  })().finally(() => {
    inFlightCookieSessionPromise = null;
  });

  return inFlightCookieSessionPromise;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  isInitialized: false,

  initialize: async () => {
    if (
      typeof window !== "undefined" &&
      window.location.pathname === "/auth/google/callback"
    ) {
      // Let the OAuth callback route establish or display the callback result without racing refresh rotation
      set({ isLoading: false, isInitialized: true });
      return;
    }

    set({ isLoading: true });
    try {
      const token = getStoredAccessToken();
      if (token) {
        try {
          const user = await apiClient.get<AuthUser>("/auth/me");
          set({ user, isAuthenticated: true, isLoading: false, isInitialized: true });
          useWishlistStore.getState().syncFromBackend().catch(() => {});
          useCartStore.getState().syncFromBackend().catch(() => {});
          return;
        } catch {
          // Token invalid or refresh failed, handled by interceptor
        }
      } else {
        try {
          await establishSessionFromRefreshCookie();
          return;
        } catch {
          // No active session cookie
        }
      }
      set({ user: null, isAuthenticated: false, isLoading: false, isInitialized: true });
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false, isInitialized: true });
    }
  },

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const res = await apiClient.post<{
        user: AuthUser;
        accessToken: string;
        refreshToken?: string;
      }>("/auth/login", {
        email: email.trim().toLowerCase(),
        password: password ?? "CustomerPass123!",
      });

      if (res?.accessToken) {
        setStoredTokens(res.accessToken, res.refreshToken);
      }

      set({ user: res.user, isAuthenticated: true, isLoading: false, isInitialized: true });
      useWishlistStore.getState().syncFromBackend().catch(() => {});
      await useCartStore.getState().mergeWithBackend().catch(() => ({ warnings: [], mergedCount: 0 }));
      return res.user;
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  register: async (payload) => {
    set({ isLoading: true });
    try {
      const res = await apiClient.post<{
        user: AuthUser;
        accessToken: string;
        refreshToken?: string;
      }>("/auth/register", {
        name: payload.name,
        email: payload.email.trim().toLowerCase(),
        phone: payload.phone,
        password: payload.password ?? "CustomerPass123!",
        preferredSize: payload.preferredSize,
        subCity: payload.subCity,
      });

      if (res?.accessToken) {
        setStoredTokens(res.accessToken, res.refreshToken);
      }

      set({ user: res.user, isAuthenticated: true, isLoading: false, isInitialized: true });
      useWishlistStore.getState().syncFromBackend().catch(() => {});
      await useCartStore.getState().mergeWithBackend().catch(() => ({ warnings: [], mergedCount: 0 }));
      return res.user;
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  loginWithGoogleOneTap: async (credential, intent = "login") => {
    set({ isLoading: true });
    try {
      const res = await apiClient.post<GoogleOneTapAuthResponse>("/auth/google/one-tap", {
        credential,
        intent,
      });

      if (res?.accessToken) {
        setStoredTokens(res.accessToken, res.refreshToken);
      }

      const authUser = res.user as unknown as AuthUser;
      set({
        user: authUser,
        isAuthenticated: true,
        isLoading: false,
        isInitialized: true,
      });
      lastCompletedCookieAuthAt = Date.now();
      useWishlistStore.getState().syncFromBackend().catch(() => {});
      await useCartStore.getState().mergeWithBackend().catch(() => ({ warnings: [], mergedCount: 0 }));
      return res;
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  completeGoogleAuth: async () => {
    set({ isLoading: true });
    try {
      return await establishSessionFromRefreshCookie();
    } catch (error) {
      clearStoredTokens();
      set({ user: null, isAuthenticated: false, isLoading: false, isInitialized: true });
      throw error;
    }
  },

  logout: async () => {
    set({ isLoading: true });
    lastCompletedCookieAuthAt = 0;
    try {
      await apiClient.post("/auth/logout").catch(() => {});
    } finally {
      clearStoredTokens();
      useWishlistStore.getState().clear();
      useCartStore.getState().clearCart();
      useNotificationStore.getState().reset();
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  updateProfile: async (patch) => {
    const current = get().user;
    if (!current) return null;
    const updated = await apiClient.patch<AuthUser>("/auth/profile", patch);
    set({
      user: {
        ...current,
        ...updated,
        avatarUrl: resolveUploadedAvatarUrl(updated.avatarUrl),
      },
    });
    return updated;
  },

  changePassword: async (payload) => {
    const res = await apiClient.post<{
      changed: boolean;
      accessToken?: string;
      refreshToken?: string;
      message?: string;
    }>("/auth/change-password", payload);
    if (res?.accessToken) {
      setStoredTokens(res.accessToken, res.refreshToken);
    }
    const current = get().user;
    if (current) {
      const nextProviders = current.authProviders?.includes("password")
        ? current.authProviders
        : [...(current.authProviders ?? []), "password" as const];
      set({
        user: {
          ...current,
          hasPassword: true,
          authProviders: nextProviders,
        },
      });
    }
  },

  logoutAll: async () => {
    set({ isLoading: true });
    lastCompletedCookieAuthAt = 0;
    try {
      await apiClient.post("/auth/logout-all").catch(() => {});
    } finally {
      clearStoredTokens();
      useWishlistStore.getState().clear();
      useCartStore.getState().clearCart();
      useNotificationStore.getState().reset();
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  deactivateAccount: async (passwordConfirm: string) => {
    set({ isLoading: true });
    lastCompletedCookieAuthAt = 0;
    try {
      await apiClient.post("/auth/deactivate", { passwordConfirm });
    } finally {
      clearStoredTokens();
      useWishlistStore.getState().clear();
      useCartStore.getState().clearCart();
      useNotificationStore.getState().reset();
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  uploadAvatar: async (avatarInput: string | File) => {
    const payload =
      typeof File !== "undefined" && avatarInput instanceof File
        ? (() => {
            const fd = new FormData();
            fd.append("avatar", avatarInput);
            return fd;
          })()
        : { avatarUrl: avatarInput };
    const res = await apiClient.post<{ id: string; avatarUrl?: string }>("/auth/avatar", payload);
    if (res?.avatarUrl && get().user) {
      set({ user: { ...get().user!, avatarUrl: res.avatarUrl } });
    }
    return res?.avatarUrl;
  },

  forgotPassword: async (email) => {
    await apiClient.post("/auth/forgot-password", { email });
  },

  resetPassword: async (payload) => {
    await apiClient.post("/auth/reset-password", payload);
  },

  refreshProfile: async () => {
    try {
      const user = await apiClient.get<AuthUser>("/auth/me");
      set({ user, isAuthenticated: true });
      return user;
    } catch {
      return get().user;
    }
  },
}));

// Wire silent unauthorized callback
onUnauthorized(() => {
  lastCompletedCookieAuthAt = 0;
  useNotificationStore.getState().reset();
  useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false });
});
