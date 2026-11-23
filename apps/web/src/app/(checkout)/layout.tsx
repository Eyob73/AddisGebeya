import type { ReactNode } from "react";

interface CheckoutLayoutProps {
  children: ReactNode;
}

export default function CheckoutLayout({ children }: CheckoutLayoutProps) {
  return <div className="min-h-screen bg-background text-foreground">{children}</div>;
}

