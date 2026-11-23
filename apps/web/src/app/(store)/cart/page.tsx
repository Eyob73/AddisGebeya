import type { Metadata } from "next";
import { CartView } from "@/features/cart/cart-view";

export const metadata: Metadata = {
  title: "Shopping Bag",
  description: "Review your AddisGebeya Shoes bag, apply promo codes, and proceed to checkout.",
};

export default function CartPage() {
  return <CartView />;
}

