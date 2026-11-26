import Link from "next/link";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  href?: string;
  className?: string;
  imgClassName?: string;
  onClick?: () => void;
}

export function BrandLogo({
  href = "/",
  className,
  imgClassName = "h-10 sm:h-11 w-auto",
  onClick,
}: BrandLogoProps) {
  const image = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/images/addisgebeya-logo.png"
      alt="AddisGebeya Shoes — Step into Your Style"
      width={1536}
      height={1024}
      className={cn(
        "object-contain transition-transform duration-300 hover:scale-[1.03] dark:rounded-xl dark:bg-white/95 dark:px-2 dark:py-0.5",
        imgClassName,
      )}
    />
  );

  if (!href) {
    return <span className={cn("inline-flex items-center shrink-0", className)}>{image}</span>;
  }

  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn("inline-flex items-center shrink-0 focus-visible:outline-none", className)}
    >
      {image}
    </Link>
  );
}

