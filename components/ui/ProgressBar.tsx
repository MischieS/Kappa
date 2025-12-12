"use client";

import type { HTMLAttributes } from "react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export interface ProgressBarProps extends HTMLAttributes<HTMLDivElement> {
  value: number; // 0-100
  showLabel?: boolean;
}

export function ProgressBar({
  value,
  showLabel,
  className,
  ...rest
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const [internal, setInternal] = useState(0);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setInternal(clamped);
    });

    return () => cancelAnimationFrame(frame);
  }, [clamped]);

  return (
    <div className={cn("space-y-1", className)} {...rest}>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-900/80">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-300 shadow-[0_0_18px_rgba(34,197,94,0.55)] transition-[width] duration-700 ease-out"
          style={{ width: `${internal}%` }}
        />
      </div>
      {showLabel ? (
        <p className="text-[11px] font-medium text-zinc-500">{clamped}%</p>
      ) : null}
    </div>
  );
}
