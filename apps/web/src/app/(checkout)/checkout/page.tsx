import * as React from "react";
import type { Metadata } from "next";
import { CheckoutPageSkeleton } from "@/components/shared/page-skeletons";
import { CheckoutView } from "@/features/checkout/checkout-view";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Finalize your AddisGebeya Shoes order with verified Ethiopian bank payments.",
};

export default function CheckoutPage() {
  return (
    <React.Suspense fallback={<CheckoutPageSkeleton />}>
      <CheckoutView />
    </React.Suspense>
  );
}
