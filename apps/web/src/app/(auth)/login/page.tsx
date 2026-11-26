"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { GoogleAuthButton } from "@/components/auth/google-auth-button";
import { BrandLogo } from "@/components/shared/brand-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/auth.store";
import { useUiStore } from "@/stores/ui.store";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginValues = z.infer<typeof loginSchema>;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from");
  const login = useAuthStore((s) => s.login);
  const addToast = useUiStore((s) => s.addToast);
  const [showPassword, setShowPassword] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: LoginValues) => {
    try {
      setIsSubmitting(true);
      const logged = await login(values.email, values.password);
      addToast({
        title: `Welcome back, ${logged.name}!`,
        description:
          logged.role === "admin"
            ? "Redirecting to Store Owner HQ Console."
            : "Signed in to your AddisGebeya Shoes account.",
        variant: "success",
      });

      const safeFrom = from && from.startsWith("/") && !from.startsWith("//") ? from : null;
      if (safeFrom) {
        router.push(safeFrom);
      } else {
        router.push(logged.role === "admin" ? "/admin" : "/account");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Invalid email or password";
      addToast({
        title: "Sign In Failed",
        description: message,
        variant: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
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
              <Link href="/forgot-password" className="font-label text-[11px] font-bold text-primary hover:underline">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute top-3 left-3.5 size-4 text-muted-foreground" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                className="pr-10 pl-10"
                placeholder="Enter your password"
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

          <Button type="submit" variant="cta" size="lg" className="mt-2 w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                <span>Signing In...</span>
              </>
            ) : (
              "Sign In"
            )}
          </Button>
        </form>

        <div className="mt-5 space-y-4">
          <div className="relative flex items-center py-1">
            <div className="grow border-t border-border" />
            <span className="mx-3 shrink-0 font-label text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
              Or continue with
            </span>
            <div className="grow border-t border-border" />
          </div>

          <GoogleAuthButton intent="login" from={from} disabled={isSubmitting} />
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

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-md animate-pulse space-y-6">
          <div className="h-12 w-32 mx-auto rounded-lg bg-surface-container" />
          <div className="h-80 w-full rounded-2xl bg-surface-container" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
