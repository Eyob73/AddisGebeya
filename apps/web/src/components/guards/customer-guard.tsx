"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";
import { AccountPageSkeleton } from "@/components/shared/page-skeletons";
import { AccountShell } from "@/components/layout/account-shell";

interface CustomerGuardProps {
  children: React.ReactNode;
}

export function CustomerGuard({ children }: CustomerGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading, isInitialized } = useAuthStore();

  React.useEffect(() => {
    if (isInitialized && !isLoading && !isAuthenticated) {
      const returnUrl = encodeURIComponent(pathname);
      router.replace(`/login?from=${returnUrl}`);
    }
  }, [isInitialized, isLoading, isAuthenticated, pathname, router]);

  if (!isInitialized || isLoading) {
    return (
      <AccountShell
        title="Loading Member Portal..."
        subtitle="Verifying your account session."
      >
        <AccountPageSkeleton />
      </AccountShell>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}

