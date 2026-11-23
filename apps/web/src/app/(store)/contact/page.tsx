"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Clock, Mail, MapPin, MessageCircle, Phone, Send } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { useCatalogStore } from "@/stores/catalog.store";
import { useUiStore } from "@/stores/ui.store";

const contactSchema = z.object({
  name: z.string().min(2, "Enter your name"),
  email: z.string().email("Enter a valid email"),
  phone: z.string().min(9, "Enter your phone number"),
  topic: z.string().min(2),
  message: z.string().min(10, "Please tell us how our Bole concierge can help"),
});

type ContactValues = z.infer<typeof contactSchema>;

export default function ContactPage() {
  const settings = useCatalogStore((s) => s.settings);
  const addToast = useUiStore((s) => s.addToast);
  const [submitted, setSubmitted] = React.useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContactValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      topic: "Shoe Sizing & Fit Consultation",
    },
  });

  const onSubmit = () => {
    setSubmitted(true);
    reset();
    addToast({
      title: "Message Received",
      description: "Our Bole Medhanialem footwear concierge will reply shortly.",
      variant: "success",
    });
  };

  return (
    <div className="mx-auto max-w-[1360px] px-4 py-10 lg:px-8 lg:py-14">
      <div className="mb-10 max-w-2xl">
        <Badge variant="secondary" className="mb-2">
          Addis Footwear Concierge
        </Badge>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          Contact AddisGebeya Shoes
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Questions about EU sizing, same-day Bole delivery, regional cargo, or Telebirr
          verification? Reach our showroom team directly.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Showroom Info Cards */}
        <div className="space-y-4 lg:col-span-5">
          {[
            {
              icon: MapPin,
              label: "Flagship Showroom & Pickup Hub",
              value: settings.showroomAddress,
            },
            {
              icon: Phone,
              label: "Direct Phone & Dispatch Line",
              value: settings.phone,
            },
            {
              icon: Mail,
              label: "Customer Concierge Email",
              value: settings.email,
            },
            {
              icon: Clock,
              label: "Showroom Opening Hours",
              value: settings.showroomHours,
            },
          ].map(({ icon: Icon, label, value }) => (
            <div
              key={label}
              className="flex items-start gap-4 rounded-2xl border border-border bg-surface p-5 shadow-card"
            >
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary">
                <Icon className="size-5" />
              </div>
              <div>
                <p className="font-label text-xs font-bold text-muted-foreground uppercase">
                  {label}
                </p>
                <p className="mt-0.5 font-display text-sm font-bold text-foreground">{value}</p>
              </div>
            </div>
          ))}

          <div className="rounded-2xl bg-primary-deep p-6 text-white shadow-md">
            <h3 className="font-display text-lg font-bold">Instant Messaging Support</h3>
            <p className="mt-1 text-xs text-[#EBF6F8]/85">
              Need an instant photo of a shoe colorway or EU insole measurement? Message our
              specialists on Telegram ({settings.telegramHandle}) or WhatsApp ({settings.whatsapp}).
            </p>
            <div className="mt-4 flex flex-wrap gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-2 font-label text-xs font-bold">
                <Send className="size-3.5" /> {settings.telegramHandle}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366] px-4 py-2 font-label text-xs font-bold text-white">
                <MessageCircle className="size-3.5" /> WhatsApp Live
              </span>
            </div>
          </div>
        </div>

        {/* Contact Inquiry Form */}
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-md sm:p-8 lg:col-span-7">
          <h2 className="font-display text-xl font-bold text-foreground">Send Us a Message</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Average response time during Addis Ababa business hours: under 20 minutes.
          </p>

          {submitted ? (
            <div className="mt-6 rounded-xl bg-emerald-50 p-5 text-sm text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
              <p className="font-bold">Thank you for contacting AddisGebeya Shoes!</p>
              <p className="mt-1 text-xs">
                We have logged your message and our Bole specialist will reach out via phone or
                email shortly.
              </p>
            </div>
          ) : null}

          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block font-label text-xs font-bold">Your Name *</label>
                <Input placeholder="Abebe Tadesse" {...register("name")} />
                {errors.name ? (
                  <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>
                ) : null}
              </div>
              <div>
                <label className="mb-1.5 block font-label text-xs font-bold">Phone Number *</label>
                <Input placeholder="+251 911 234 567" {...register("phone")} />
                {errors.phone ? (
                  <p className="mt-1 text-xs text-destructive">{errors.phone.message}</p>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block font-label text-xs font-bold">Email Address *</label>
                <Input type="email" placeholder="you@gmail.com" {...register("email")} />
                {errors.email ? (
                  <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>
                ) : null}
              </div>
              <div>
                <label className="mb-1.5 block font-label text-xs font-bold">Inquiry Topic</label>
                <select
                  {...register("topic")}
                  className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none"
                >
                  <option>Shoe Sizing &amp; Fit Consultation</option>
                  <option>Order Status &amp; Delivery</option>
                  <option>7-Day Size Exchange Request</option>
                  <option>Telebirr / CBE Payment Verification</option>
                  <option>Showroom Try-On Appointment</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block font-label text-xs font-bold">Message *</label>
              <Textarea
                rows={4}
                placeholder="Tell us the shoe model, EU size, or order number..."
                {...register("message")}
              />
              {errors.message ? (
                <p className="mt-1 text-xs text-destructive">{errors.message.message}</p>
              ) : null}
            </div>

            <Button type="submit" variant="cta" size="lg">
              <Send className="size-4" /> Send Inquiry
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

