"use client";

import { useMemo, useState } from "react";
import type { Trader } from "@/lib/types/trader";
import { TraderCard } from "@/components/dashboard/TraderCard";
import { cn } from "@/lib/utils";

interface TradersSectionProps {
  traders: Trader[];
}

type TraderFilter = "all" | "kappa" | "not_maxed" | "maxed";

const FILTERS: { id: TraderFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "kappa", label: "Kappa-critical" },
  { id: "not_maxed", label: "Not maxed" },
  { id: "maxed", label: "Maxed" },
];

export function TradersSection({ traders }: TradersSectionProps) {
  const [filter, setFilter] = useState<TraderFilter>("kappa");

  const filtered = useMemo(() => {
    switch (filter) {
      case "kappa":
        return traders.filter((t) => t.kappaRequired);
      case "maxed":
        return traders.filter((t) => t.level >= t.maxLevel);
      case "not_maxed":
        return traders.filter((t) => t.level < t.maxLevel);
      default:
        return traders;
    }
  }, [filter, traders]);

  return (
    <section aria-label="Traders" className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Traders
          </h2>
          <span className="text-[11px] text-zinc-500">
            {traders.length} tracked
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[11px]">
          {FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950",
                  active
                    ? "border-emerald-500/70 bg-emerald-500/15 text-emerald-200"
                    : "border-zinc-800/80 bg-zinc-900/70 text-zinc-400 hover:border-emerald-500/40 hover:text-emerald-200",
                )}
              >
                {active && (
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                )}
                <span>{f.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((trader) => (
          <TraderCard key={trader.id} trader={trader} />
        ))}
      </div>
    </section>
  );
}
