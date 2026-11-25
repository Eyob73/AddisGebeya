import type { ReactNode } from "react";
import { CustomerGuard } from "@/components/guards/customer-guard";

interface AccountLayoutProps {
  children: ReactNode;
}

export default function AccountLayout({ children }: AccountLayoutProps) {
  return <CustomerGuard>{children}</CustomerGuard>;
}

