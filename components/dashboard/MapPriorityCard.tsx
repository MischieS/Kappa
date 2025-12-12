"use client";

import { useMemo, useState } from "react";
import type { Quest } from "@/lib/types/quest";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Map as MapIcon } from "lucide-react";

interface MapPriorityCardProps {
  quests: Quest[];
}

function normalizeMapName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const map = raw.trim();
  if (!map) return null;

  const lower = map.toLowerCase();

  if (lower === "any") return null;

  if (lower === "night factory" || lower === "factory (night)" || lower === "factory night") {
    return "Factory";
  }

  return map;
}

export function MapPriorityCard({ quests }: MapPriorityCardProps) {
  const [kappaOnly, setKappaOnly] = useState(false);

  const mapStats = useMemo(() => {
    const active = quests.filter((quest) => quest.status !== "completed" && quest.status !== "locked");
    const filtered = kappaOnly ? active.filter((q) => q.kappaRequired) : active;

    const counts = new Map<string, number>();

    for (const quest of filtered) {
      const normalized = normalizeMapName(quest.map);
      if (!normalized) continue;
      const map = normalized;
      counts.set(map, (counts.get(map) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([map, count]) => ({ map, count }))
      .sort((a, b) => b.count - a.count);
  }, [quests, kappaOnly]);

  if (!mapStats.length) return null;

  const [top, ...rest] = mapStats;

  return (
    <Card className="h-full border-zinc-900/80 bg-zinc-950/90">
      <CardHeader className="flex items-center justify-between gap-3 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-300">
            <MapIcon className="h-3.5 w-3.5" />
          </span>
          <div className="space-y-0.5">
            <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
              Map priority
            </CardTitle>
            <p className="text-[11px] text-zinc-500">
              Focus maps with the most active quests.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant={kappaOnly ? "primary" : "ghost"}
          size="sm"
          className="rounded-full px-3 text-[11px]"
          onClick={() => setKappaOnly((prev) => !prev)}
        >
          Show only Kappa quests
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 pb-4">
        <div className="grid gap-2 rounded-2xl border border-zinc-900/80 bg-zinc-950/80 p-2">
          {/* Top map emphasized */}
          <button
            type="button"
            className="flex items-center justify-between rounded-xl border border-amber-500/60 bg-gradient-to-r from-amber-500/20 via-amber-500/8 to-transparent px-3 py-2.5 text-left text-xs text-zinc-100 transition-colors hover:border-amber-400"
          >
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-200/90">
                {top.map}
              </p>
              <p className="mt-1 text-lg font-semibold text-amber-200">
                {top.count}
                <span className="ml-1 align-middle text-[11px] font-normal text-zinc-200/80">
                  active quests
                </span>
              </p>
            </div>
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          </button>

          {/* Remaining maps */}
          <div className="grid grid-cols-2 gap-2 text-xs text-zinc-300">
            {rest.map((entry) => (
              <button
                type="button"
                key={entry.map}
                className="flex flex-col justify-between rounded-xl border border-zinc-900/80 bg-zinc-950/80 px-3 py-2 text-left transition-colors hover:border-zinc-600/80"
              >
                <span className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
                  {entry.map}
                </span>
                <span className="mt-2 text-[11px] text-zinc-400">
                  {entry.count} active quests
                </span>
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
