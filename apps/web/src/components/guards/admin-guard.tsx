"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { SkeletonBase } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth.store";
import { useUiStore } from "@/stores/ui.store";

interface AdminGuardProps {
  children: React.ReactNode;
}

export function AdminGuard({ children }: AdminGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading, isInitialized, user } = useAuthStore();
  const addToast = useUiStore((s) => s.addToast);
  const [deniedToastShown, setDeniedToastShown] = React.useState(false);

  React.useEffect(() => {
    if (!isInitialized || isLoading) return;

    if (!isAuthenticated) {
      const returnUrl = encodeURIComponent(pathname);
      router.replace(`/login?from=${returnUrl}`);
      return;
    }

    if (user?.role !== "admin" && !deniedToastShown) {
      addToast({
        title: "Access Denied",
        description: "You do not have administrative privileges to access the Owner HQ.",
        variant: "error",
      });
      setDeniedToastShown(true);
    }
  }, [isInitialized, isLoading, isAuthenticated, user, pathname, router, addToast, deniedToastShown]);

  if (!isInitialized || isLoading) {
    return (
      <div className="flex min-h-screen bg-background">
        <div className="hidden lg:block w-64 border-r border-border p-6 space-y-4">
          <SkeletonBase className="h-8 w-36 rounded-lg" />
          <div className="space-y-2 pt-6">
            <SkeletonBase className="h-10 w-full rounded-xl" />
            <SkeletonBase className="h-10 w-full rounded-xl" />
            <SkeletonBase className="h-10 w-full rounded-xl" />
          </div>
        </div>
        <div className="flex-1 p-8 space-y-6">
          <SkeletonBase className="h-10 w-64 rounded-lg" />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <SkeletonBase className="h-28 rounded-2xl" />
            <SkeletonBase className="h-28 rounded-2xl" />
            <SkeletonBase className="h-28 rounded-2xl" />
            <SkeletonBase className="h-28 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (user?.role !== "admin") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-background">
        <div className="max-w-md rounded-2xl border border-destructive/30 bg-surface p-8 text-center shadow-lg">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <ShieldAlert className="size-8" />
          </div>
          <h1 className="font-display text-2xl font-black text-foreground">
            Access Restricted
          </h1>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            The Store Owner Console is restricted to authenticated administrators. Your current account (<strong className="text-foreground">{user?.email}</strong>) has customer-level permissions.
          </p>
          <div className="mt-6 flex flex-col gap-2.5">
            <Button asChild variant="cta" className="w-full">
              <Link href="/account">Go to Customer Account</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/" className="inline-flex items-center justify-center gap-1.5">
                <ArrowLeft className="size-4" /> Return to Storefront
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
