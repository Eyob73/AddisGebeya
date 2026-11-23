import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardStatCardProps {
  label: string;
  value: string;
  unit?: string;
  icon: LucideIcon;
  accent?: "primary" | "cta";
  badge?: string;
  subLeft?: string;
  subRight?: string;
  progressPercent?: number;
  className?: string;
}

export function DashboardStatCard({
  label,
  value,
  unit,
  icon: Icon,
  accent = "primary",
  badge,
  subLeft,
  subRight,
  progressPercent,
  className,
}: DashboardStatCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col justify-between rounded-xl border border-border bg-surface p-5 shadow-card transition-shadow hover:shadow-card-hover",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-label text-xs font-bold tracking-wider text-muted-foreground uppercase">
          {label}
        </span>
        <span
          className={cn(
            "flex size-10 items-center justify-center rounded-full",
            accent === "cta" ? "bg-[#FFDBD0] text-cta" : "bg-primary-light text-primary",
          )}
        >
          <Icon className="size-5" aria-hidden="true" />
        </span>
      </div>

      <div className="my-4">
        <div className="flex items-baseline gap-1.5 font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
          <span>{value}</span>
          {unit ? <span className="text-sm font-semibold text-muted-foreground">{unit}</span> : null}
        </div>
        {badge ? (
          <div className="mt-1.5 inline-flex items-center rounded-full bg-surface-container px-2.5 py-0.5 font-label text-[11px] font-bold text-primary">
            {badge}
          </div>
        ) : null}
      </div>

      {progressPercent !== undefined ? (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-high">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
          />
        </div>
      ) : subLeft || subRight ? (
        <div className="flex items-center justify-between gap-2 pt-1 font-label text-xs text-muted-foreground">
          <span>{subLeft}</span>
          <span className={cn("font-bold", accent === "cta" ? "text-cta" : "text-primary")}>
            {subRight}
          </span>
        </div>
      ) : null}
    </div>
  );
}

