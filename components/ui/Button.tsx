"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "ghost" | "outline";
export type ButtonSize = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconLeft?: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-emerald-500/90 text-zinc-950 hover:bg-emerald-400 focus-visible:ring-emerald-400",
  ghost:
    "bg-transparent text-zinc-300 hover:bg-zinc-900/60 focus-visible:ring-zinc-700",
  outline:
    "border border-zinc-700/80 bg-zinc-950/60 text-zinc-100 hover:bg-zinc-900/80 focus-visible:ring-zinc-600",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-3.5 text-sm",
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  iconLeft,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium tracking-tight outline-none transition-colors focus-visible:ring-2 focus-visible:ring-offset-0 disabled:opacity-60",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...rest}
    >
      {iconLeft ? <span className="inline-flex items-center">{iconLeft}</span> : null}
      {children}
    </button>
  );
}
