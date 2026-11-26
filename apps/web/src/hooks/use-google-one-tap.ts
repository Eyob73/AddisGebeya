"use client";

import * as React from "react";
import { storeService } from "@/services/store.service";

interface GoogleCredentialResponse {
  credential?: string;
  select_by?: string;
}

interface GooglePromptMomentNotification {
  isNotDisplayed: () => boolean;
  isSkippedMoment: () => boolean;
  isDismissedMoment: () => boolean;
  getNotDisplayedReason?: () => string;
  getSkippedReason?: () => string;
  getDismissedReason?: () => string;
}

interface GoogleAccountsIdApi {
  initialize: (config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    context?: "signin" | "signup" | "use";
    itp_support?: boolean;
    use_fedcm_for_prompt?: boolean;
  }) => void;
  prompt: (listener?: (notification: GooglePromptMomentNotification) => void) => void;
  cancel: () => void;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: GoogleAccountsIdApi;
      };
    };
  }
}

const GIS_SCRIPT_ID = "google-identity-services-script";
const GIS_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

let gisScriptPromise: Promise<boolean> | null = null;

function loadGoogleIdentityScript(): Promise<boolean> {
  if (typeof window === "undefined") {
    return Promise.resolve(false);
  }
  if (window.google?.accounts?.id) {
    return Promise.resolve(true);
  }
  if (gisScriptPromise) {
    return gisScriptPromise;
  }

  gisScriptPromise = new Promise<boolean>((resolve) => {
    const existing = document.getElementById(GIS_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      if (window.google?.accounts?.id) {
        resolve(true);
        return;
      }
      existing.addEventListener("load", () => resolve(Boolean(window.google?.accounts?.id)), {
        once: true,
      });
      existing.addEventListener("error", () => resolve(false), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = GIS_SCRIPT_ID;
    script.src = GIS_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(Boolean(window.google?.accounts?.id));
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });

  return gisScriptPromise;
}

export type GoogleOneTapStatus =
  | "idle"
  | "loading"
  | "prompting"
  | "suppressed"
  | "unavailable";

interface UseGoogleOneTapOptions {
  enabled: boolean;
  context?: "signin" | "signup" | "use";
  onCredential: (credential: string) => void | Promise<void>;
}

/**
 * Integrates Google Identity Services (GIS) One Tap non-intrusively on public checkout views
 * using the backend's existing Google OAuth client configuration.
 */
export function useGoogleOneTap({
  enabled,
  context = "use",
  onCredential,
}: UseGoogleOneTapOptions) {
  const [clientId, setClientId] = React.useState<string | null>(null);
  const [googleConfigured, setGoogleConfigured] = React.useState(false);
  const [status, setStatus] = React.useState<GoogleOneTapStatus>("idle");

  const callbackRef = React.useRef(onCredential);

  React.useEffect(() => {
    callbackRef.current = onCredential;
  }, [onCredential]);

  React.useEffect(() => {
    let active = true;
    storeService
      .getGooglePublicConfig()
      .then((cfg) => {
        if (!active) return;
        setGoogleConfigured(Boolean(cfg.enabled && cfg.clientId));
        setClientId(cfg.enabled && cfg.clientId ? cfg.clientId : null);
        if (!cfg.enabled || !cfg.clientId) {
          setStatus("unavailable");
        }
      })
      .catch(() => {
        if (!active) return;
        setGoogleConfigured(false);
        setClientId(null);
        setStatus("unavailable");
      });

    return () => {
      active = false;
    };
  }, []);

  React.useEffect(() => {
    if (!enabled || !clientId) {
      window.google?.accounts?.id?.cancel();
      return;
    }

    let cancelled = false;

    loadGoogleIdentityScript().then((loaded) => {
      if (cancelled) return;
      const gsiId = window.google?.accounts?.id;
      if (!loaded || !gsiId) {
        setStatus("unavailable");
        return;
      }

      try {
        gsiId.initialize({
          client_id: clientId,
          callback: (response) => {
            if (cancelled) return;
            if (response?.credential) {
              void callbackRef.current(response.credential);
            }
          },
          auto_select: false,
          cancel_on_tap_outside: true,
          context,
          itp_support: true,
          use_fedcm_for_prompt: true,
        });

        setStatus("prompting");
        gsiId.prompt((notification) => {
          if (cancelled) return;
          if (
            notification.isNotDisplayed() ||
            notification.isSkippedMoment() ||
            notification.isDismissedMoment()
          ) {
            setStatus("suppressed");
          }
        });
      } catch {
        setStatus("unavailable");
      }
    });

    return () => {
      cancelled = true;
      try {
        window.google?.accounts?.id?.cancel();
      } catch {
        // Ignore cleanup errors when GIS wasn't initialized yet
      }
    };
  }, [enabled, clientId, context]);

  return {
    googleConfigured,
    oneTapStatus: !enabled ? "idle" : status,
  };
}

