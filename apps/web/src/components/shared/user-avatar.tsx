"use client";

import * as React from "react";
import { getUserInitials, resolveUploadedAvatarUrl } from "@addisgebeya/shared";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  src?: string | null;
  name?: string | null;
  alt: string;
  className?: string;
  uploadedClassName?: string;
  blankClassName?: string;
  roundedClassName?: string;
}

/**
 * Displays the user's actual uploaded profile image when present, or renders
 * first/last name initials ("AB" or "A") while preserving layout dimensions and styling.
 */
export function UserAvatar({
  src,
  name,
  alt,
  className,
  uploadedClassName,
  blankClassName,
  roundedClassName = "rounded-full",
}: UserAvatarProps) {
  const [failedUrl, setFailedUrl] = React.useState<string | null>(null);
  const resolvedUrl = resolveUploadedAvatarUrl(src);
  const canRenderImage = Boolean(resolvedUrl && failedUrl !== resolvedUrl);
  const initials = getUserInitials(name);

  if (canRenderImage && resolvedUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={resolvedUrl}
        alt={alt}
        referrerPolicy="no-referrer"
        onError={() => setFailedUrl(resolvedUrl)}
        className={cn(roundedClassName, "shrink-0 object-cover", className, uploadedClassName)}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        roundedClassName,
        "inline-flex shrink-0 select-none items-center justify-center bg-primary font-display text-xs font-bold text-primary-foreground",
        className,
        blankClassName,
      )}
    >
      {initials}
    </span>
  );
}
