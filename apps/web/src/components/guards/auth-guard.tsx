"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";
import { SkeletonBase } from "@/components/ui/skeleton";

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
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
      <div className="mx-auto max-w-[1360px] p-8 space-y-6">
        <SkeletonBase className="h-10 w-48 rounded-lg" />
        <SkeletonBase className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
