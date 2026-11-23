import type { Metadata } from "next";
import { ProductFormView } from "@/features/admin/product-form-view";

export const metadata: Metadata = {
  title: "Add New Shoe Model",
};

export default function AdminNewProductPage() {
  return <ProductFormView />;
}

