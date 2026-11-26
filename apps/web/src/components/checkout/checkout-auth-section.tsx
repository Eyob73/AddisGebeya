"use client";

import * as React from "react";
import {
  AlertCircle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  UserCheck,
  X,
} from "lucide-react";
import { GoogleAuthButton } from "@/components/auth/google-auth-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { GoogleOneTapStatus } from "@/hooks/use-google-one-tap";
import { useAuthStore } from "@/stores/auth.store";
import { cn } from "@/lib/utils";

interface CheckoutAuthSectionProps {
  mode: "choose" | "guest";
  oneTapStatus: GoogleOneTapStatus;
  googleConfigured: boolean;
  isOneTapVerifying: boolean;
  authError: string | null;
  onClearAuthError: () => void;
  onBeforeGoogleRedirect: () => void;
  onEmailSignInSuccess: () => void;
  onSelectGuestMode: () => void;
  onReopenAuthOptions: () => void;
}

export function CheckoutAuthSection({
  mode,
  oneTapStatus,
  googleConfigured,
  isOneTapVerifying,
  authError,
  onClearAuthError,
  onBeforeGoogleRedirect,
  onEmailSignInSuccess,
  onSelectGuestMode,
  onReopenAuthOptions,
}: CheckoutAuthSectionProps) {
  const login = useAuthStore((s) => s.login);

  const [showEmailForm, setShowEmailForm] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [inlineError, setInlineError] = React.useState<string | null>(null);
  const [isSubmittingEmail, setIsSubmittingEmail] = React.useState(false);

  const activeError = authError ?? inlineError;

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setInlineError(null);
    onClearAuthError();

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      setInlineError("Please enter a valid email address.");
      return;
    }
    if (!password) {
      setInlineError("Please enter your password.");
      return;
    }

    setIsSubmittingEmail(true);
    try {
      await login(trimmedEmail, password);
      onEmailSignInSuccess();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Invalid email or password. Please verify and try again.";
      setInlineError(msg);
    } finally {
      setIsSubmittingEmail(false);
    }
  };

  if (mode === "guest") {
    return (
      <div
        data-testid="checkout-guest-banner"
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary-light/60 px-5 py-3.5 text-xs"
      >
        <div className="flex items-start gap-2.5 sm:items-center">
          <UserCheck className="mt-0.5 size-4 shrink-0 text-primary sm:mt-0" />
          <div>
            <span className="font-display font-bold text-foreground">Checking out as Guest</span>
            <span className="mx-1.5 text-muted-foreground">•</span>
            <span className="text-muted-foreground">
              No account needed. Track your order anytime using your order reference &amp; email.
            </span>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onReopenAuthOptions}
          className="h-8 bg-surface text-xs font-semibold"
        >
          Sign In / Use Google
        </Button>
      </div>
    );
  }

  return (
    <section
      aria-labelledby="checkout-auth-heading"
      data-testid="checkout-auth-section"
      className="rounded-2xl border border-border bg-surface p-6 shadow-card sm:p-7"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <Badge variant="soft" className="gap-1">
              <Sparkles className="size-3" /> Express Checkout
            </Badge>
            {isOneTapVerifying ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                <Loader2 className="size-3 animate-spin" /> Signing you in with Google...
              </span>
            ) : oneTapStatus === "prompting" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                <ShieldCheck className="size-3" /> Google One Tap Active
              </span>
            ) : null}
          </div>
          <h2 id="checkout-auth-heading" className="font-display text-xl font-extrabold text-foreground">
            Choose How to Continue Checkout
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Sign in with one tap to auto-fill your details and merge your bag, or check out right
            away as a guest — no registration forced.
          </p>
        </div>
      </div>

      {activeError ? (
        <div
          role="alert"
          className="mt-4 flex items-start justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-800 dark:text-rose-200"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-bold">Sign-In Could Not Be Completed</p>
              <p className="mt-0.5 leading-relaxed opacity-90">{activeError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setInlineError(null);
              onClearAuthError();
            }}
            aria-label="Dismiss authentication error"
            className="rounded-md p-1 hover:bg-rose-500/20 cursor-pointer"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : null}

      <div className="mt-5 space-y-4">
        {/* Option 1: Continue with Google */}
        <div className="rounded-xl border border-primary/20 bg-surface-low/60 p-4">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <span className="font-display text-sm font-bold text-foreground">
              Fastest Option: Continue with Google
            </span>
            <span className="font-label text-[10px] font-bold tracking-wider text-primary uppercase">
              1-Click Verified
            </span>
          </div>
          <GoogleAuthButton
            intent="login"
            from="/checkout"
            label={isOneTapVerifying ? "Signing in with Google..." : "Continue with Google"}
            disabled={isOneTapVerifying || !googleConfigured}
            onBeforeRedirect={onBeforeGoogleRedirect}
            className="h-12 border-border bg-surface text-sm shadow-xs hover:border-primary/40"
          />
          {!googleConfigured ? (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Google Sign-In is currently unavailable. Please sign in with email or continue as
              guest below.
            </p>
          ) : (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Preserves your current bag items and returns you directly to the delivery step.
            </p>
          )}
        </div>

        {/* Option 2 & 3 Grid: Sign in with email | Continue as Guest */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              setShowEmailForm((prev) => !prev);
              setInlineError(null);
            }}
            aria-expanded={showEmailForm}
            data-testid="checkout-toggle-email-signin"
            className={cn(
              "flex items-center justify-between gap-2 rounded-xl border px-4 py-3.5 text-left transition-all cursor-pointer",
              showEmailForm
                ? "border-primary bg-primary-light/50 text-foreground"
                : "border-border bg-surface hover:border-primary/50 hover:bg-surface-low",
            )}
          >
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Mail className="size-4" />
              </span>
              <div>
                <p className="font-display text-xs font-bold text-foreground">Sign in with Email</p>
                <p className="text-[11px] text-muted-foreground">Existing AddisGebeya account</p>
              </div>
            </div>
            {showEmailForm ? (
              <ChevronUp className="size-4 text-primary" />
            ) : (
              <ChevronDown className="size-4 text-muted-foreground" />
            )}
          </button>

          <button
            type="button"
            onClick={onSelectGuestMode}
            data-testid="checkout-continue-guest"
            className="group flex items-center justify-between gap-2 rounded-xl border border-cta/40 bg-cta/5 px-4 py-3.5 text-left transition-all hover:border-cta hover:bg-cta/10 cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-cta text-cta-foreground">
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
              <div>
                <p className="font-display text-xs font-bold text-foreground">Continue as Guest</p>
                <p className="text-[11px] text-muted-foreground">Instant checkout without signup</p>
              </div>
            </div>
          </button>
        </div>

        {/* Collapsible Inline Email Sign-In Form */}
        {showEmailForm ? (
          <form
            onSubmit={handleEmailSignIn}
            data-testid="checkout-inline-email-form"
            className="space-y-3 rounded-xl border border-border bg-surface-low/50 p-4"
          >
            <div className="flex items-center justify-between">
              <span className="font-display text-xs font-bold text-foreground">
                Sign in with your AddisGebeya credentials
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <Lock className="size-3" /> Bag stays intact
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="checkout-login-email"
                  className="mb-1 block font-label text-[11px] font-bold text-muted-foreground"
                >
                  Email Address
                </label>
                <Input
                  id="checkout-login-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmittingEmail}
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="checkout-login-password"
                  className="mb-1 block font-label text-[11px] font-bold text-muted-foreground"
                >
                  Password
                </label>
                <Input
                  id="checkout-login-password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSubmittingEmail}
                  required
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <p className="text-[11px] text-muted-foreground">
                Don&apos;t have an account? Use Google above or choose Continue as Guest.
              </p>
              <Button
                type="submit"
                variant="cta"
                size="sm"
                disabled={isSubmittingEmail}
                className="min-w-36"
              >
                {isSubmittingEmail ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <span>Sign In &amp; Continue</span>
                )}
              </Button>
            </div>
          </form>
        ) : null}
      </div>
    </section>
  );
}

