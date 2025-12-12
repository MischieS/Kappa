"use client";

import type { Trader } from "@/lib/types/trader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { percentage } from "@/lib/utils";

export interface TraderCardProps {
  trader: Trader;
}

export function TraderCard({ trader }: TraderCardProps) {
  const levelPct = percentage(trader.level, trader.maxLevel || 1);
  const repPct = percentage(
    trader.reputation,
    trader.reputationRequiredForNextLevel || 1,
  );

  const isMaxed = trader.level >= trader.maxLevel;

  return (
    <Card
      interactive
      className="relative h-full overflow-hidden border border-zinc-800/80 bg-zinc-950/80"
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="text-sm font-semibold text-zinc-100">
              {trader.name}
            </CardTitle>
            <CardDescription className="text-[11px] text-zinc-500">
              Level {trader.level} / {trader.maxLevel}
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-1">
            {trader.kappaRequired ? (
              <Badge variant="success" className="text-[10px]">
                Kappa
              </Badge>
            ) : null}
            {isMaxed ? (
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
                Maxed
              </span>
            ) : (
              <span className="rounded-full bg-zinc-800/80 px-2 py-0.5 text-[11px] text-zinc-400">
                Progressing
              </span>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pb-4 pt-1">
        <div>
          <div className="mb-1 flex items-center justify-between text-[11px] text-zinc-500">
            <span>Loyalty level</span>
            <span>{levelPct}%</span>
          </div>
          <ProgressBar value={levelPct} />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between text-[11px] text-zinc-500">
            <span>Reputation</span>
            <span>
              {trader.reputation.toFixed(2)} /{" "}
              {trader.reputationRequiredForNextLevel.toFixed(2)}
            </span>
          </div>
          <ProgressBar value={repPct} />
        </div>
      </CardContent>
    </Card>
  );
}
