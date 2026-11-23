"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Eye, EyeOff, Lock, Mail, ShieldCheck, Store, User } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { BrandLogo } from "@/components/shared/brand-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEMO_CUSTOMER, DEMO_OWNER, useAuthStore } from "@/stores/auth.store";
import { useUiStore } from "@/stores/ui.store";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const addToast = useUiStore((s) => s.addToast);
  const [showPassword, setShowPassword] = React.useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: DEMO_CUSTOMER.email,
      password: "password123",
    },
  });

  const onSubmit = (values: LoginValues) => {
    const logged = login(values.email);
    addToast({
      title: `Welcome back, ${logged.name}!`,
      description:
        logged.role === "admin"
          ? "Redirecting to Store Owner HQ Console."
          : "Signed in to your AddisGebeya Shoes account.",
      variant: "success",
    });
    router.push(logged.role === "admin" ? "/admin" : "/account");
  };

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="flex flex-col items-center text-center">
        <BrandLogo imgClassName="h-14 w-auto mb-3" />
        <Badge variant="secondary">Step into Your Style</Badge>
        <h1 className="mt-3 font-display text-2xl font-extrabold text-foreground">
          Sign In to AddisGebeya Shoes
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track your Addis Ababa orders, manage your saved EU sizes, and access VIP sneaker drops.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-6 shadow-md sm:p-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block font-label text-xs font-bold">
              Email Address
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute top-3 left-3.5 size-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                className="pl-10"
                placeholder="you@example.com"
                {...register("email")}
              />
            </div>
            {errors.email ? (
              <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>
            ) : null}
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="password" className="font-label text-xs font-bold">
                Password
              </label>
              <Link href="/contact" className="font-label text-[11px] font-bold text-primary hover:underline">
                Need help?
              </Link>
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute top-3 left-3.5 size-4 text-muted-foreground" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                className="pr-10 pl-10"
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label="Toggle password visibility"
                className="absolute top-3 right-3 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {errors.password ? (
              <p className="mt-1 text-xs text-destructive">{errors.password.message}</p>
            ) : null}
          </div>

          <Button type="submit" variant="cta" size="lg" className="mt-2 w-full">
            Sign In
          </Button>
        </form>

        {/* Quick Demo Role Switchers (Clearly labeled temporary preview auth) */}
        <div className="mt-6 space-y-2.5 border-t border-border pt-5">
          <p className="flex items-center justify-center gap-1.5 font-label text-[11px] font-bold text-muted-foreground uppercase">
            <ShieldCheck className="size-3.5 text-primary" /> Local Preview Quick Fill
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setValue("email", DEMO_CUSTOMER.email);
                setValue("password", "password123");
              }}
            >
              <User className="size-3.5" /> Customer Demo
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setValue("email", DEMO_OWNER.email);
                setValue("password", "owner1234");
              }}
            >
              <Store className="size-3.5" /> Store Owner
            </Button>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          New to AddisGebeya Shoes?{" "}
          <Link href="/register" className="font-bold text-primary hover:underline">
            Create an account
          </Link>
        </p>
      </div>

      <div className="text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 font-label text-xs font-bold text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="size-3.5" /> Return to Storefront
        </Link>
      </div>
    </div>
  );
}

