import type { ReactNode } from "react";
import { GuestGuard } from "@/components/guards/guest-guard";

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <GuestGuard>
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
        {children}
      </div>
    </GuestGuard>
  );
}
