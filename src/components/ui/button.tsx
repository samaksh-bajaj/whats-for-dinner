import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "quiet" | "danger";
type Size = "lg" | "md" | "sm";

const base =
  "inline-flex items-center justify-center gap-2 font-medium transition-colors " +
  "disabled:cursor-not-allowed disabled:opacity-40 active:translate-y-px";

const variants: Record<Variant, string> = {
  primary:
    "bg-paprika text-surface hover:bg-paprika-deep disabled:hover:bg-paprika",
  secondary:
    "bg-surface text-ink border border-line hover:border-ink-faint disabled:hover:border-line",
  quiet: "text-ink-soft hover:text-ink hover:bg-sunk",
  danger:
    "bg-surface text-paprika border border-paprika/35 hover:bg-paprika hover:text-surface",
};

// 52px tall at `lg` — comfortably past the 44px touch-target floor for a
// primary action sitting at the bottom of a phone screen.
const sizes: Record<Size, string> = {
  lg: "h-[52px] px-6 text-[17px] rounded-xl w-full",
  md: "h-11 px-4 text-[15px] rounded-lg",
  sm: "h-9 px-3 text-[14px] rounded-lg",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
}) {
  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    />
  );
}
