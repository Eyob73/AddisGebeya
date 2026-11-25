"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Mail } from "lucide-react";
import { BrandLogo } from "@/components/shared/brand-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/auth.store";
import { useUiStore } from "@/stores/ui.store";

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState("");
  const [submitted, setSubmitted] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const forgotPassword = useAuthStore((s) => s.forgotPassword);
  const addToast = useUiStore((s) => s.addToast);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    try {
      setIsSubmitting(true);
      await forgotPassword(email.trim().toLowerCase());
      setSubmitted(true);
      addToast({
        title: "Password Reset Link Sent",
        description: `Instructions sent to ${email}. Check your inbox.`,
        variant: "success",
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to request password reset.";
      addToast({
        title: "Request Failed",
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
        <Badge variant="secondary">Account Recovery</Badge>
        <h1 className="mt-3 font-display text-2xl font-extrabold text-foreground">
          Reset Your Password
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter your registered email address and we will send you a secure verification link to regain access.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-6 shadow-md sm:p-8">
        {submitted ? (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary-light text-primary">
              <CheckCircle2 className="size-6" />
            </div>
            <h2 className="font-display text-lg font-bold text-foreground">Check Your Inbox</h2>
            <p className="text-xs text-muted-foreground">
              We sent a password reset link to <strong className="text-foreground">{email}</strong>.
            </p>
            <div className="pt-2 space-y-2">
              <Button asChild variant="cta" className="w-full">
                <Link href="/reset-password">Set New Password Now</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/login">Return to Sign In</Link>
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block font-label text-xs font-bold">
                Email Address
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute top-3 left-3.5 size-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. kidus@addisgebeya.et"
                  className="pl-10"
                />
              </div>
            </div>

            <Button type="submit" variant="cta" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Sending Reset Link..." : "Send Reset Link"}
            </Button>
          </form>
        )}

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
