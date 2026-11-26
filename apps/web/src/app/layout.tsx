import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, Manrope, Plus_Jakarta_Sans } from "next/font/google";
import { AppProviders } from "@/components/providers/app-providers";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "AddisGebeya Shoes — Step into Your Style",
    template: "%s | AddisGebeya Shoes",
  },
  description:
    "Ethiopia's premier single-vendor footwear destination. Authentic athletic, streetwear, running, and handcrafted leather shoes delivered across Addis Ababa and Ethiopia.",
  icons: {
    icon: [{ url: "/images/addisgebeya-logo.png", type: "image/png" }],
    shortcut: "/images/addisgebeya-logo.png",
    apple: "/images/addisgebeya-logo.png",
  },
  openGraph: {
    title: "AddisGebeya Shoes — Step into Your Style",
    description:
      "Ethiopia's premier single-vendor footwear destination. Authentic athletic, streetwear, running, and handcrafted leather shoes delivered across Addis Ababa and Ethiopia.",
    images: [
      {
        url: "/images/addisgebeya-logo.png",
        width: 1536,
        height: 1024,
        alt: "AddisGebeya Shoes — Step into Your Style",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AddisGebeya Shoes — Step into Your Style",
    images: ["/images/addisgebeya-logo.png"],
  },
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} ${inter.variable} ${manrope.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background text-foreground font-sans antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
