"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Laptop,
  Lock,
  LogOut,
  Mail,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Trash2,
  User,
  UserX,
} from "lucide-react";
import { AccountShell } from "@/components/layout/account-shell";
import { PushNotificationSettingsCard } from "@/components/notifications/PushNotificationSettingsCard";
import { AccountPageSkeleton } from "@/components/shared/page-skeletons";
import { useIsMounted } from "@/hooks/use-is-mounted";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModalDialog } from "@/components/ui/dialog";
import { useAuthStore } from "@/stores/auth.store";
import { useUiStore } from "@/stores/ui.store";

export default function AccountSettingsPage() {
  const router = useRouter();
  const { user, logout, logoutAll, deactivateAccount } = useAuthStore();
  const addToast = useUiStore((s) => s.addToast);
  const isMounted = useIsMounted();

  const [isLogoutAllOpen, setIsLogoutAllOpen] = React.useState(false);
  const [isDeactivateOpen, setIsDeactivateOpen] = React.useState(false);
  const [passwordConfirm, setPasswordConfirm] = React.useState("");
  const [isProcessing, setIsProcessing] = React.useState(false);

  const handleLogoutCurrent = async () => {
    try {
      await logout();
      addToast({
        title: "Logged Out",
        description: "You have been logged out of your session.",
        variant: "default",
      });
      router.push("/login");
    } catch {
      router.push("/login");
    }
  };

  const handleLogoutAllDevices = async () => {
    setIsProcessing(true);
    try {
      await logoutAll();
      setIsLogoutAllOpen(false);
      addToast({
        title: "Logged Out From All Devices",
        description: "All active sessions and refresh tokens have been revoked.",
        variant: "success",
      });
      router.push("/login");
    } catch {
      router.push("/login");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeactivate = async (e: React.FormEvent) => {
    e.preventDefault();
    const hasPassword = user?.hasPassword !== false;
    if (!passwordConfirm) {
      addToast({
        title: hasPassword ? "Password Required" : "Confirmation Required",
        description: hasPassword
          ? "Please enter your password to confirm account deactivation."
          : 'Please type "DEACTIVATE" to confirm account deactivation.',
        variant: "warning",
      });
      return;
    }

    setIsProcessing(true);
    try {
      await deactivateAccount(passwordConfirm);
      setIsDeactivateOpen(false);
      addToast({
        title: "Account Deactivated",
        description: "Your account has been deactivated and all sessions terminated.",
        variant: "default",
      });
      router.push("/");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to deactivate account.";
      addToast({
        title: "Deactivation Failed",
        description: msg,
        variant: "error",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isMounted) {
    return (
      <AccountShell
        title="Account Settings"
        subtitle="Manage session devices, email verification, and account security controls."
      >
        <AccountPageSkeleton />
      </AccountShell>
    );
  }

  return (
    <AccountShell
      title="Account Settings"
      subtitle="Manage session devices, email verification, and account security controls."
    >
      <div className="space-y-8 max-w-4xl">
        {/* Email Verification & Account Status */}
        <section className="rounded-2xl border border-border bg-surface p-6 shadow-card sm:p-8">
          <div className="mb-5 flex items-center gap-2.5">
            <Mail className="size-5 text-primary" />
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">
                Email Verification &amp; Account Status
              </h2>
              <p className="text-xs text-muted-foreground">
                Verification status of your primary email address for order notifications and password recovery.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-border/80 bg-surface-low p-4">
              <div className="space-y-1">
                <span className="font-label text-xs font-bold text-muted-foreground">
                  Primary Email
                </span>
                <p className="font-bold text-sm text-foreground">{user?.email}</p>
                <div className="flex items-center gap-1.5 pt-1">
                  <Badge variant="success" className="text-[10px]">
                    <CheckCircle2 className="size-3 mr-1" /> Verified Address
                  </Badge>
                  <span className="text-[11px] text-muted-foreground">
                    Confirmed via authentication token
                  </span>
                </div>
              </div>

              <Button asChild variant="outline" size="sm">
                <Link href="/account/profile">Change Email</Link>
              </Button>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border/80 bg-surface-low p-4 text-xs">
              <div>
                <span className="font-bold text-foreground">Account Standing</span>
                <p className="text-muted-foreground">
                  Good standing • Member of Addis Performance Running Club
                </p>
              </div>
              <Badge variant="soft" className="text-emerald-700 dark:text-emerald-300">
                Active
              </Badge>
            </div>
          </div>
        </section>

        {/* Device Push Notifications */}
        <PushNotificationSettingsCard />

        {/* Active Sessions & Device Management */}
        <section className="rounded-2xl border border-border bg-surface p-6 shadow-card sm:p-8">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Laptop className="size-5 text-primary" />
              <div>
                <h2 className="font-display text-lg font-bold text-foreground">
                  Session &amp; Device Management
                </h2>
                <p className="text-xs text-muted-foreground">
                  Manage browser sessions where your AddisGebeya account is currently logged in.
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsLogoutAllOpen(true)}
              className="text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-900/50 dark:hover:bg-rose-950/40"
            >
              <LogOut className="size-3.5 mr-1" /> Logout All Devices
            </Button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary-light/10 p-4">
              <div className="flex items-center gap-3.5">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <Laptop className="size-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-sm text-foreground">Current Web Browser</p>
                    <Badge variant="success" className="text-[10px]">
                      Active Now
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Next.js Web Client • Addis Ababa, Ethiopia
                  </p>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleLogoutCurrent}
                className="text-xs"
              >
                Log Out
              </Button>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border/80 bg-surface-low p-4">
              <div className="flex items-center gap-3.5">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-media text-muted-foreground">
                  <Smartphone className="size-5" />
                </div>
                <div>
                  <p className="font-bold text-sm text-foreground">Mobile Sessions</p>
                  <p className="text-xs text-muted-foreground">
                    Telebirr SuperApp and mobile browser sessions are protected with refresh-token rotation.
                  </p>
                </div>
              </div>

              <span className="text-xs text-muted-foreground font-mono">Protected</span>
            </div>
          </div>
        </section>

        {/* Danger Zone: Account Deactivation */}
        <section className="rounded-2xl border border-rose-200 dark:border-rose-900/40 bg-rose-500/5 p-6 shadow-card sm:p-8">
          <div className="mb-5 flex items-center gap-2.5">
            <ShieldAlert className="size-5 text-rose-600 dark:text-rose-400" />
            <div>
              <h2 className="font-display text-lg font-bold text-rose-700 dark:text-rose-400">
                Danger Zone: Account Deactivation
              </h2>
              <p className="text-xs text-muted-foreground">
                Permanently disable account access and revoke active authentication tokens.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-rose-200 dark:border-rose-900/40 bg-surface p-5 space-y-4">
            <div className="space-y-2 text-xs text-muted-foreground leading-relaxed">
              <p className="font-bold text-foreground">Before you deactivate your account:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>You will immediately be logged out from all devices.</li>
                <li>You will not be able to log in or place new footwear orders.</li>
                <li>
                  Past order and payment records are preserved in our database to comply with Ethiopian tax, commerce, and logistics regulations.
                </li>
                <li>Your saved addresses and cart data will be archived.</li>
              </ul>
            </div>

            <div className="flex justify-end pt-2 border-t border-border">
              <Button
                type="button"
                variant="cta"
                onClick={() => setIsDeactivateOpen(true)}
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
                <UserX className="size-4 mr-1.5" /> Deactivate My Account
              </Button>
            </div>
          </div>
        </section>

        {/* Logout All Confirmation Dialog */}
        <ModalDialog
          open={isLogoutAllOpen}
          onClose={() => setIsLogoutAllOpen(false)}
          title="Log Out of All Devices?"
          description="This will revoke all active sessions and refresh tokens across all devices. You will need to log in again on all browsers."
        >
          <div className="flex justify-end gap-2.5 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsLogoutAllOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="cta"
              onClick={handleLogoutAllDevices}
              disabled={isProcessing}
            >
              {isProcessing ? "Revoking..." : "Log Out All Devices"}
            </Button>
          </div>
        </ModalDialog>

        {/* Account Deactivation Dialog */}
        <ModalDialog
          open={isDeactivateOpen}
          onClose={() => setIsDeactivateOpen(false)}
          title="Confirm Account Deactivation"
          description={
            user?.hasPassword === false
              ? 'To confirm account deactivation, type "DEACTIVATE" below.'
              : "To confirm account deactivation, please enter your current account password below."
          }
        >
          <form onSubmit={handleDeactivate} className="space-y-4 pt-2">
            <div className="rounded-xl border border-amber-200 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
              <p className="font-bold">Caution:</p>
              <p>This action will immediately disable your customer account and revoke all sessions.</p>
            </div>

            <div>
              <label className="mb-1 block font-label text-xs font-bold text-muted-foreground">
                {user?.hasPassword === false ? 'Type "DEACTIVATE" *' : "Confirm Password *"}
              </label>
              <Input
                type={user?.hasPassword === false ? "text" : "password"}
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                placeholder={
                  user?.hasPassword === false ? "DEACTIVATE" : "Enter your current password"
                }
                required
              />
            </div>

            <div className="flex justify-end gap-2.5 border-t border-border pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDeactivateOpen(false)}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="cta"
                disabled={isProcessing || !passwordConfirm}
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
                {isProcessing ? "Deactivating..." : "Confirm Deactivation"}
              </Button>
            </div>
          </form>
        </ModalDialog>
      </div>
    </AccountShell>
  );
}

