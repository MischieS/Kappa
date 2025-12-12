import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { cn, percentage } from "@/lib/utils";

export type KpiTrend = "up" | "down" | "steady";

export interface KpiCardProps {
  label: string;
  value: string | number;
  helperText?: string;
  icon?: ReactNode;
  trend?: KpiTrend;
  trendLabel?: string;
  progress?: {
    completed: number;
    total: number;
  };
}

const trendClasses: Record<NonNullable<KpiTrend>, string> = {
  up: "bg-emerald-500/10 text-emerald-300",
  down: "bg-rose-500/10 text-rose-300",
  steady: "bg-zinc-700/20 text-zinc-300",
};

export function KpiCard({
  label,
  value,
  helperText,
  icon,
  trend,
  trendLabel,
  progress,
}: KpiCardProps) {
  const pct = progress ? percentage(progress.completed, progress.total) : undefined;

  return (
    <Card
      interactive
      className={cn(
        "relative h-full overflow-hidden border border-zinc-800/80 bg-zinc-950/80",
        "before:pointer-events-none before:absolute before:-left-10 before:top-0 before:h-24 before:w-24 before:rotate-12 before:bg-emerald-500/10 before:blur-3xl before:opacity-0 before:transition-opacity before:duration-200 hover:before:opacity-100",
      )}
    >
      <CardHeader className="flex items-start justify-between gap-3 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            {label}
          </CardTitle>
          {helperText ? (
            <CardDescription className="text-[11px] text-zinc-500">
              {helperText}
            </CardDescription>
          ) : null}
        </div>
        {icon ? (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800/80 bg-zinc-900/80 text-zinc-200">
            {icon}
          </div>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-3 pb-4 pt-1">
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
        <div className="flex items-center justify-between gap-2">
          {trend && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                trendClasses[trend],
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              <span>{trendLabel}</span>
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
