"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  HelpCircle,
  KeyRound,
  Lock,
  Shield,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { AccountShell } from "@/components/layout/account-shell";
import { AccountPageSkeleton } from "@/components/shared/page-skeletons";
import { useIsMounted } from "@/hooks/use-is-mounted";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/auth.store";
import { useUiStore } from "@/stores/ui.store";

export default function SecurityPage() {
  const { user, changePassword } = useAuthStore();
  const addToast = useUiStore((s) => s.addToast);
  const isMounted = useIsMounted();
  const hasPassword = user?.hasPassword !== false;
  const authProviders = user?.authProviders ?? (hasPassword ? ["password"] : []);

  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");

  const [showCurrent, setShowCurrent] = React.useState(false);
  const [showNew, setShowNew] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);

  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Password strength calculation
  const strengthMetrics = React.useMemo(() => {
    const hasMinLength = newPassword.length >= 8;
    const hasUpper = /[A-Z]/.test(newPassword);
    const hasLower = /[a-z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);

    let score = 0;
    if (newPassword.length >= 6) score++;
    if (hasMinLength) score++;
    if (hasUpper && hasLower) score++;
    if (hasNumber || hasSpecial) score++;

    let label = "Enter a password";
    let colorClass = "bg-muted";
    let textClass = "text-muted-foreground";

    if (newPassword.length > 0) {
      if (score <= 1) {
        label = "Weak password";
        colorClass = "bg-rose-500";
        textClass = "text-rose-600 dark:text-rose-400";
      } else if (score === 2) {
        label = "Fair password";
        colorClass = "bg-amber-500";
        textClass = "text-amber-600 dark:text-amber-400";
      } else if (score === 3) {
        label = "Good password";
        colorClass = "bg-sky-500";
        textClass = "text-sky-600 dark:text-sky-400";
      } else {
        label = "Strong password";
        colorClass = "bg-emerald-500";
        textClass = "text-emerald-600 dark:text-emerald-400";
      }
    }

    return {
      score,
      label,
      colorClass,
      textClass,
      hasMinLength,
      hasUpper,
      hasLower,
      hasNumber,
      hasSpecial,
    };
  }, [newPassword]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (hasPassword && !currentPassword) {
      addToast({
        title: "Current Password Required",
        description: "Please enter your existing password to verify ownership.",
        variant: "warning",
      });
      return;
    }

    if (newPassword.length < 8) {
      addToast({
        title: "Password Too Short",
        description: "New password must be at least 8 characters long.",
        variant: "warning",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      addToast({
        title: "Passwords Do Not Match",
        description: "New password and confirmation must match exactly.",
        variant: "warning",
      });
      return;
    }

    if (hasPassword && newPassword === currentPassword) {
      addToast({
        title: "Password Reused",
        description: "Your new password must be different from your current password.",
        variant: "warning",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await changePassword({
        ...(hasPassword ? { currentPassword } : {}),
        newPassword,
      });
      addToast({
        title: hasPassword ? "Password Changed Successfully" : "Password Created Successfully",
        description: hasPassword
          ? "Your password has been updated. Other active sessions have been securely rotated."
          : "You can now sign in with email and password or continue using Google.",
        variant: "success",
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to change password. Please check your current password.";
      addToast({
        title: "Password Change Failed",
        description: errorMsg,
        variant: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isMounted) {
    return (
      <AccountShell
        title="Password & Security"
        subtitle="Manage your credentials, password strength, and active authentication sessions."
      >
        <AccountPageSkeleton />
      </AccountShell>
    );
  }

  return (
    <AccountShell
      title="Password & Security"
      subtitle="Manage your credentials, password strength, and active authentication sessions."
    >
      <div className="space-y-8">
        {/* Security Notice Card */}
        <div className="flex items-start gap-3.5 rounded-2xl border border-primary/20 bg-primary-light/30 p-5 shadow-xs">
          <ShieldCheck className="size-6 shrink-0 text-primary mt-0.5" />
          <div className="space-y-1">
            <h3 className="font-display text-sm font-bold text-foreground">
              Account Protection &amp; Session Invalidation
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              When you change your password, AddisGebeya automatically revokes all other active device sessions and refresh tokens to prevent unauthorized account access. Your current browser session will remain securely active with a fresh token.
            </p>
          </div>
        </div>

        {/* Change / Set Password Form */}
        <section className="rounded-2xl border border-border bg-surface p-6 shadow-card sm:p-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <div className="flex items-center gap-2.5">
              <KeyRound className="size-5 text-primary" />
              <div>
                <h2 className="font-display text-lg font-bold text-foreground">
                  {hasPassword ? "Update Account Password" : "Set an Account Password"}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {hasPassword
                    ? "Choose a robust password with uppercase letters, numbers, and symbols."
                    : "Your account currently signs in with Google. Add a password as a secondary sign-in method."}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {authProviders.includes("google") ? (
                <Badge variant="success" className="text-[10px]">
                  Google Connected
                </Badge>
              ) : null}
              {hasPassword ? (
                <Link
                  href="/forgot-password"
                  className="font-label text-xs font-bold text-primary hover:underline"
                >
                  Forgot Password?
                </Link>
              ) : null}
            </div>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-6 max-w-xl">
            {/* Current Password */}
            {hasPassword ? (
              <div>
                <label className="mb-1.5 block font-label text-xs font-bold text-muted-foreground">
                  Current Password
                </label>
                <div className="relative">
                  <Input
                    type={showCurrent ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-3 top-3 text-muted-foreground hover:text-foreground cursor-pointer"
                    aria-label={showCurrent ? "Hide password" : "Show password"}
                  >
                    {showCurrent ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
            ) : null}

            {/* New Password */}
            <div>
              <label className="mb-1.5 block font-label text-xs font-bold text-muted-foreground">
                New Password
              </label>
              <div className="relative">
                <Input
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground cursor-pointer"
                  aria-label={showNew ? "Hide password" : "Show password"}
                >
                  {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>

              {/* Password Strength Meter */}
              {newPassword.length > 0 && (
                <div className="mt-2.5 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-label text-[11px] font-bold text-muted-foreground">Strength:</span>
                    <span className={`font-display text-xs font-bold ${strengthMetrics.textClass}`}>
                      {strengthMetrics.label}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-surface-low overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${strengthMetrics.colorClass}`}
                      style={{ width: `${(strengthMetrics.score / 4) * 100}%` }}
                    />
                  </div>

                  {/* Requirements Checklist */}
                  <div className="grid grid-cols-2 gap-1.5 pt-2 text-[11px] text-muted-foreground">
                    <span className={`flex items-center gap-1 ${strengthMetrics.hasMinLength ? "text-emerald-600 font-semibold" : ""}`}>
                      <Check className={`size-3 ${strengthMetrics.hasMinLength ? "opacity-100" : "opacity-30"}`} /> 8+ characters
                    </span>
                    <span className={`flex items-center gap-1 ${strengthMetrics.hasUpper && strengthMetrics.hasLower ? "text-emerald-600 font-semibold" : ""}`}>
                      <Check className={`size-3 ${strengthMetrics.hasUpper && strengthMetrics.hasLower ? "opacity-100" : "opacity-30"}`} /> Upper &amp; lowercase
                    </span>
                    <span className={`flex items-center gap-1 ${strengthMetrics.hasNumber ? "text-emerald-600 font-semibold" : ""}`}>
                      <Check className={`size-3 ${strengthMetrics.hasNumber ? "opacity-100" : "opacity-30"}`} /> At least 1 number
                    </span>
                    <span className={`flex items-center gap-1 ${strengthMetrics.hasSpecial ? "text-emerald-600 font-semibold" : ""}`}>
                      <Check className={`size-3 ${strengthMetrics.hasSpecial ? "opacity-100" : "opacity-30"}`} /> Special symbol (@#$)
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Confirm New Password */}
            <div>
              <label className="mb-1.5 block font-label text-xs font-bold text-muted-foreground">
                Confirm New Password
              </label>
              <div className="relative">
                <Input
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground cursor-pointer"
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                >
                  {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                <p className="mt-1 text-xs text-rose-500 font-medium">
                  Passwords do not match.
                </p>
              )}
            </div>

            <div className="pt-4 border-t border-border flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                BCrypt encrypted (Salt rounds: 12)
              </span>
              <Button type="submit" disabled={isSubmitting}>
                <Lock className="size-4 mr-1.5" />
                {isSubmitting
                  ? hasPassword
                    ? "Changing Password..."
                    : "Setting Password..."
                  : hasPassword
                    ? "Change Password"
                    : "Set Password"}
              </Button>
            </div>
          </form>
        </section>
      </div>
    </AccountShell>
  );
}

