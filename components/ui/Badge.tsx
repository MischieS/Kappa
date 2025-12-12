import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type BadgeVariant =
  | "default"
  | "outline"
  | "success"
  | "warning"
  | "danger"
  | "muted";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  default:
    "bg-zinc-900/80 text-zinc-100 border border-zinc-700/80",
  outline:
    "border border-zinc-700/80 text-zinc-300",
  muted:
    "bg-zinc-900/60 text-zinc-400 border border-zinc-800/80",
  success:
    "border border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
  warning:
    "border border-amber-500/40 bg-amber-500/15 text-amber-300",
  danger:
    "border border-rose-500/40 bg-rose-500/15 text-rose-300",
};

export function Badge({
  className,
  variant = "default",
  ...rest
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium uppercase tracking-[0.14em]",
        variantClasses[variant],
        className,
      )}
      {...rest}
    />
  );
}
