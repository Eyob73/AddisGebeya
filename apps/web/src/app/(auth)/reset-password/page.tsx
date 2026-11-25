"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import { BrandLogo } from "@/components/shared/brand-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/auth.store";
import { useUiStore } from "@/stores/ui.store";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "demo-reset-token";
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const resetPassword = useAuthStore((s) => s.resetPassword);
  const addToast = useUiStore((s) => s.addToast);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setError("");

    try {
      setIsSubmitting(true);
      await resetPassword({ token, newPassword: password });
      addToast({
        title: "Password Updated Successfully",
        description: "You can now sign in with your new password.",
        variant: "success",
      });
      router.push("/login");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to reset password.";
      setError(message);
      addToast({
        title: "Password Reset Failed",
        description: message,
        variant: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="flex flex-col items-center text-center">
        <BrandLogo imgClassName="h-14 w-auto mb-3" />
        <Badge variant="secondary">Secure Password Reset</Badge>
        <h1 className="mt-3 font-display text-2xl font-extrabold text-foreground">
          Set New Password
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose a strong password to protect your AddisGebeya Shoes account.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-6 shadow-md sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="new-password" className="mb-1.5 block font-label text-xs font-bold">
              New Password
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute top-3 left-3.5 size-4 text-muted-foreground" />
              <Input
                id="new-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="pl-10"
              />
            </div>
          </div>

          <div>
            <label htmlFor="confirm-password" className="mb-1.5 block font-label text-xs font-bold">
              Confirm New Password
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute top-3 left-3.5 size-4 text-muted-foreground" />
              <Input
                id="confirm-password"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                className="pl-10"
              />
            </div>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <Button type="submit" variant="cta" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Updating Password..." : "Update Password & Sign In"}
          </Button>
        </form>

        <div className="mt-6 border-t border-border pt-4 text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
          >
            <ArrowLeft className="size-3.5" /> Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-md animate-pulse space-y-6">
          <div className="h-12 w-32 mx-auto rounded-lg bg-surface-container" />
          <div className="h-80 w-full rounded-2xl bg-surface-container" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
