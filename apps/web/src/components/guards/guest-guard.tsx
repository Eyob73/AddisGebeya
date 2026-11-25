"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";
import { SkeletonBase } from "@/components/ui/skeleton";

interface GuestGuardProps {
  children: React.ReactNode;
}

function GuestGuardInner({ children }: GuestGuardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading, isInitialized, user } = useAuthStore();

  React.useEffect(() => {
    if (isInitialized && !isLoading && isAuthenticated) {
      const from = searchParams.get("from");
      const safeRedirect = from && from.startsWith("/") && !from.startsWith("//") ? from : null;

      if (user?.role === "admin") {
        router.replace(safeRedirect ?? "/admin");
      } else {
        router.replace(safeRedirect ?? "/account");
      }
    }
  }, [isInitialized, isLoading, isAuthenticated, user, searchParams, router]);

  if (!isInitialized) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-md space-y-4">
          <SkeletonBase className="mx-auto h-12 w-32 rounded-xl" />
          <SkeletonBase className="h-80 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}

export function GuestGuard({ children }: GuestGuardProps) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="w-full max-w-md space-y-4">
            <SkeletonBase className="mx-auto h-12 w-32 rounded-xl" />
            <SkeletonBase className="h-80 w-full rounded-2xl" />
          </div>
        </div>
      }
    >
      <GuestGuardInner>{children}</GuestGuardInner>
    </Suspense>
  );
}
