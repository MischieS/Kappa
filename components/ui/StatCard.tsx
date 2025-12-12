import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { cn, percentage } from "@/lib/utils";

export interface StatCardProps {
  label: string;
  value: string | number;
  helperText?: string;
  icon?: ReactNode;
  variant?: "default" | "success" | "warning" | "danger";
  progress?: {
    completed: number;
    total: number;
  };
}

const variantClasses: Record<NonNullable<StatCardProps["variant"]>, string> = {
  default: "border-zinc-800/80",
  success:
    "border-emerald-500/60 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent",
  warning:
    "border-amber-500/60 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent",
  danger:
    "border-rose-500/60 bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-transparent",
};

export function StatCard({
  label,
  value,
  helperText,
  icon,
  variant = "default",
  progress,
}: StatCardProps) {
  const pct = progress ? percentage(progress.completed, progress.total) : undefined;

  return (
    <Card
      interactive
      className={cn(
        "h-full border border-zinc-800/80 bg-zinc-950/70",
        variantClasses[variant],
      )}
    >
      <CardHeader className="flex items-center justify-between gap-3 pb-2">
        <div>
          <CardTitle className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
            {label}
          </CardTitle>
          {helperText ? (
            <CardDescription className="mt-1 text-[11px] text-zinc-500">
              {helperText}
            </CardDescription>
          ) : null}
        </div>
        {icon ? (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800/80 bg-zinc-900/70 text-zinc-200">
            {icon}
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="pb-4 pt-1">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold tracking-tight text-zinc-50">
            {value}
          </span>
          {typeof pct === "number" ? (
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
              {pct}%
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
