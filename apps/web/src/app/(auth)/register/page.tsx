"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Mail, Phone, Ruler, User } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { BrandLogo } from "@/components/shared/brand-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ADDIS_SUBCITIES, EU_SIZES } from "@/data/mock-footwear";
import { useAuthStore } from "@/stores/auth.store";
import { useUiStore } from "@/stores/ui.store";

const registerSchema = z
  .object({
    name: z.string().min(2, "Enter your full name"),
    email: z.string().email("Enter a valid email address"),
    phone: z.string().min(9, "Enter a valid Ethiopian phone number"),
    preferredSize: z.number().min(38).max(46),
    subCity: z.string().min(2),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(6, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type RegisterValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const registerUser = useAuthStore((s) => s.register);
  const addToast = useUiStore((s) => s.addToast);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      preferredSize: 42,
      subCity: ADDIS_SUBCITIES[0],
      phone: "+251 9",
    },
  });

  const onSubmit = (values: RegisterValues) => {
    registerUser({
      name: values.name,
      email: values.email,
      phone: values.phone,
      preferredSize: values.preferredSize,
      subCity: values.subCity,
    });
    addToast({
      title: "Account Created!",
      description: `Welcome to AddisGebeya Shoes, ${values.name}. Enjoy 10% off with WELCOME10.`,
      variant: "success",
    });
    router.push("/account");
  };

  return (
    <div className="w-full max-w-lg space-y-6">
      <div className="flex flex-col items-center text-center">
        <BrandLogo imgClassName="h-14 w-auto mb-3" />
        <Badge variant="secondary">Join AddisGebeya VIP Circle</Badge>
        <h1 className="mt-3 font-display text-2xl font-extrabold text-foreground">
          Create Your Customer Account
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Save your EU shoe size, speed up Bole express checkout, and unlock early drop access.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-6 shadow-md sm:p-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="name" className="mb-1.5 block font-label text-xs font-bold">
                Full Name *
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute top-3 left-3.5 size-4 text-muted-foreground" />
                <Input
                  id="name"
                  className="pl-10"
                  placeholder="e.g., Hanna Tesfaye"
                  {...register("name")}
                />
              </div>
              {errors.name ? (
                <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>
              ) : null}
            </div>

            <div>
              <label htmlFor="email" className="mb-1.5 block font-label text-xs font-bold">
                Email Address *
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute top-3 left-3.5 size-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  className="pl-10"
                  placeholder="hanna@gmail.com"
                  {...register("email")}
                />
              </div>
              {errors.email ? (
                <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>
              ) : null}
            </div>

            <div>
              <label htmlFor="phone" className="mb-1.5 block font-label text-xs font-bold">
                Phone Number *
              </label>
              <div className="relative">
                <Phone className="pointer-events-none absolute top-3 left-3.5 size-4 text-muted-foreground" />
                <Input id="phone" type="tel" className="pl-10" {...register("phone")} />
              </div>
              {errors.phone ? (
                <p className="mt-1 text-xs text-destructive">{errors.phone.message}</p>
              ) : null}
            </div>

            <div>
              <label htmlFor="preferredSize" className="mb-1.5 block font-label text-xs font-bold">
                Preferred EU Size
              </label>
              <div className="relative">
                <Ruler className="pointer-events-none absolute top-3 left-3.5 size-4 text-muted-foreground" />
                <select
                  id="preferredSize"
                  {...register("preferredSize", { valueAsNumber: true })}
                  className="h-11 w-full rounded-lg border border-border bg-surface pr-3 pl-10 text-sm text-foreground focus:border-primary focus:outline-none"
                >
                  {EU_SIZES.map((sz) => (
                    <option key={sz} value={sz}>
                      EU {sz}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="subCity" className="mb-1.5 block font-label text-xs font-bold">
                Addis Sub-City
              </label>
              <select
                id="subCity"
                {...register("subCity")}
                className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none"
              >
                {ADDIS_SUBCITIES.map((sc) => (
                  <option key={sc} value={sc}>
                    {sc}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block font-label text-xs font-bold">
                Password *
              </label>
              <Input id="password" type="password" {...register("password")} />
              {errors.password ? (
                <p className="mt-1 text-xs text-destructive">{errors.password.message}</p>
              ) : null}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="mb-1.5 block font-label text-xs font-bold">
                Confirm Password *
              </label>
              <Input id="confirmPassword" type="password" {...register("confirmPassword")} />
              {errors.confirmPassword ? (
                <p className="mt-1 text-xs text-destructive">{errors.confirmPassword.message}</p>
              ) : null}
            </div>
          </div>

          <Button type="submit" variant="cta" size="lg" className="mt-2 w-full">
            Create Customer Account
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-bold text-primary hover:underline">
            Sign in here
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

