import type { Metadata } from "next";
import { CheckoutView } from "@/features/checkout/checkout-view";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Finalize your AddisGebeya Shoes order with Addis Ababa Express Dispatch.",
};

export default function CheckoutPage() {
  return <CheckoutView />;
}

