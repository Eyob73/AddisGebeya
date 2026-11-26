"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { isSafeRedirectPath } from "@addisgebeya/validation";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { GoogleAuthButton } from "@/components/auth/google-auth-button";
import { BrandLogo } from "@/components/shared/brand-logo";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth.store";
import { useUiStore } from "@/stores/ui.store";

function resolveOAuthErrorDescription(code: string | null, serverMessage: string | null): string {
  if (serverMessage) return serverMessage;
  switch (code) {
    case "OAUTH_CANCELLED":
      return "You cancelled Google sign-in before authorization was completed.";
    case "ACCOUNT_DEACTIVATED":
      return "This account has been deactivated or suspended. Please contact AddisGebeya support.";
    case "EMAIL_NOT_VERIFIED":
      return "Your Google email address must be verified before signing in.";
    case "INVALID_OAUTH_STATE":
    case "EXPIRED_OAUTH_STATE":
      return "Your Google sign-in session expired or could not be verified. Please try again.";
    case "OAUTH_ACCOUNT_CONFLICT":
      return "This email address is already linked to a different Google account.";
    case "GOOGLE_OAUTH_NOT_CONFIGURED":
      return "Google Sign-In is not configured on the server yet.";
    default:
      return "Google authentication could not be completed. Please try again.";
  }
}

function GoogleOAuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const completeGoogleAuth = useAuthStore((s) => s.completeGoogleAuth);
  const addToast = useUiStore((s) => s.addToast);

  const statusParam = searchParams.get("status");
  const errorParam = searchParams.get("error");
  const messageParam = searchParams.get("message");
  const isNewUser = searchParams.get("isNewUser") === "true";
  const linkedExisting = searchParams.get("linked") === "true";
  const fromParam = searchParams.get("from");
  const intentParam = searchParams.get("intent") === "register" ? "register" : "login";

  const [exchangeError, setExchangeError] = React.useState<string | null>(null);
  const errorToastShownRef = React.useRef(false);

  const urlErrorMessage =
    statusParam !== "success"
      ? resolveOAuthErrorDescription(
          errorParam,
          messageParam ?? (statusParam === null ? "Missing OAuth callback status." : null),
        )
      : null;

  React.useEffect(() => {
    if (urlErrorMessage && !errorToastShownRef.current) {
      errorToastShownRef.current = true;
      addToast({
        title: errorParam === "OAUTH_CANCELLED" ? "Google Sign-In Cancelled" : "Google Sign-In Failed",
        description: urlErrorMessage,
        variant: errorParam === "OAUTH_CANCELLED" ? "warning" : "error",
      });
    }
  }, [urlErrorMessage, errorParam, addToast]);

  React.useEffect(() => {
    if (statusParam !== "success") return;
    let active = true;

    completeGoogleAuth()
      .then(async (authenticatedUser) => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["orders"] }),
          queryClient.invalidateQueries({ queryKey: ["addresses"] }),
          queryClient.invalidateQueries({ queryKey: ["notifications"] }),
          queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] }),
        ]);

        if (!active) return;

        if (isNewUser) {
          addToast({
            title: "Welcome to AddisGebeya Shoes!",
            description: `Customer account created with Google for ${authenticatedUser.name}.`,
            variant: "success",
          });
        } else if (linkedExisting) {
          addToast({
            title: "Google Account Linked",
            description: `Welcome back, ${authenticatedUser.name}. Your Google login is now linked.`,
            variant: "success",
          });
        } else {
          addToast({
            title: `Welcome back, ${authenticatedUser.name}!`,
            description:
              authenticatedUser.role === "admin"
                ? "Redirecting to Store Owner HQ Console."
                : "Signed in to your AddisGebeya Shoes account.",
            variant: "success",
          });
        }

        const safeFrom = fromParam && isSafeRedirectPath(fromParam) ? fromParam : null;
        const destination =
          safeFrom === "/checkout"
            ? "/checkout?auth=google_success"
            : (safeFrom ?? (authenticatedUser.role === "admin" ? "/admin" : "/account"));
        router.replace(destination);
      })
      .catch((err: unknown) => {
        if (!active) return;
        const msg =
          err instanceof Error
            ? err.message
            : "We could not complete your Google sign-in session. Please try again.";
        setExchangeError(msg);
        addToast({
          title: "Authentication Error",
          description: msg,
          variant: "error",
        });
      });

    return () => {
      active = false;
    };
  }, [
    statusParam,
    isNewUser,
    linkedExisting,
    fromParam,
    completeGoogleAuth,
    queryClient,
    addToast,
    router,
  ]);

  const activeError = urlErrorMessage ?? exchangeError;
  const retryHref = intentParam === "register" ? "/register" : "/login";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center">
          <BrandLogo imgClassName="h-14 w-auto mb-3" />
        </div>

        <div className="rounded-2xl border border-border bg-surface p-6 text-center shadow-md sm:p-8">
          {activeError ? (
            <div className="space-y-5">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400">
                <AlertCircle className="size-6" aria-hidden="true" />
              </div>

              <div className="space-y-2">
                <h1 className="font-display text-xl font-extrabold text-foreground">
                  {errorParam === "OAUTH_CANCELLED"
                    ? "Google Sign-In Cancelled"
                    : "Unable to Complete Google Sign-In"}
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed">{activeError}</p>
              </div>

              <div className="space-y-2.5 pt-2">
                <GoogleAuthButton
                  intent={intentParam}
                  from={fromParam}
                  label="Try Again with Google"
                />
                {fromParam && isSafeRedirectPath(fromParam) && fromParam.startsWith("/checkout") ? (
                  <Button asChild variant="secondary" size="lg" className="w-full">
                    <Link href="/checkout?mode=guest">Continue as Guest at Checkout</Link>
                  </Button>
                ) : null}
                <Button asChild variant="outline" size="lg" className="w-full">
                  <Link href={retryHref}>
                    {intentParam === "register" ? "Return to Registration" : "Return to Sign In"}
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Loader2 className="size-6 animate-spin" aria-hidden="true" />
              </div>
              <div className="space-y-1.5">
                <h1 className="font-display text-xl font-extrabold text-foreground">
                  {isNewUser
                    ? "Creating Your AddisGebeya Account"
                    : "Completing Google Sign-In"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  Securing your session and syncing your Ethiopian profile preferences...
                </p>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="size-3.5" aria-hidden="true" />
                Google Identity Verified
              </div>
            </div>
          )}
        </div>

        <div className="text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 font-label text-xs font-bold text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="size-3.5" /> Return to Storefront
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function GoogleOAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
          <div className="w-full max-w-md animate-pulse space-y-6">
            <div className="mx-auto h-12 w-32 rounded-lg bg-surface-container" />
            <div className="h-64 w-full rounded-2xl bg-surface-container" />
          </div>
        </div>
      }
    >
      <GoogleOAuthCallbackInner />
    </Suspense>
  );
}

