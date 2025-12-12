"use client";

import { useEffect, useMemo, useState } from "react";
import type { Trader } from "@/lib/types/trader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

interface TraderStandingsCardProps {
  traders: Trader[];
  initialStandings?: { traderId: string; level: number }[] | null;
}

function LevelPills({
  level,
  maxLevel,
  onChange,
}: {
  level: number;
  maxLevel: number;
  onChange: (value: number) => void;
}) {
  const pills = [];
  for (let i = 1; i <= maxLevel; i += 1) {
    const active = i <= level;
    pills.push(
      <button
        type="button"
        key={i}
        onClick={() => onChange(i)}
        className={`inline-flex h-6 w-6 items-center justify-center rounded-md border text-[10px] font-semibold transition-colors ${
          active
            ? "border-sky-500/80 bg-sky-500/15 text-sky-200 hover:border-sky-400"
            : "border-zinc-700/80 bg-zinc-900/80 text-zinc-500 hover:border-zinc-500"
        }`}
      >
        {i}
      </button>,
    );
  }
  return <div className="flex gap-1.5">{pills}</div>;
}

export function TraderStandingsCard({ traders, initialStandings }: TraderStandingsCardProps) {
  const order: Record<string, number> = {
    Prapor: 1,
    Therapist: 2,
    Skier: 3,
    Peacekeeper: 4,
    Mechanic: 5,
    Ragman: 6,
    Jaeger: 7,
    Fence: 8,
  };

  const sorted = useMemo(
    () =>
      [...traders].sort((a, b) => {
        const aIdx = order[a.name] ?? 999;
        const bIdx = order[b.name] ?? 999;
        if (aIdx !== bIdx) return aIdx - bIdx;
        return a.name.localeCompare(b.name);
      }),
    [traders],
  );

  const [levelsById, setLevelsById] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};

    for (const trader of traders) {
      initial[trader.id] = trader.level;
    }

    if (Array.isArray(initialStandings)) {
      for (const standing of initialStandings) {
        if (!standing || !standing.traderId) continue;
        const trader = traders.find((t) => t.id === String(standing.traderId));
        if (!trader) continue;
        const rawLevel = Number(standing.level ?? trader.level);
        if (Number.isNaN(rawLevel)) continue;
        const clamped = Math.min(trader.maxLevel, Math.max(1, rawLevel));
        initial[trader.id] = clamped;
      }
    }

    return initial;
  });

  useEffect(() => {
    let cancelled = false;

    async function loadTraderStandings() {
      let loaded: Record<string, number> | null = null;

      if (typeof window !== "undefined") {
        try {
          const raw = window.localStorage.getItem("traderStandings");
          if (raw) {
            const parsed = JSON.parse(raw) as { traderId?: string; level?: number }[];
            const next: Record<string, number> = {};
            for (const entry of parsed) {
              if (!entry || !entry.traderId) continue;
              const trader = traders.find((t) => t.id === String(entry.traderId));
              if (!trader) continue;
              const rawLevel = Number(entry.level ?? trader.level);
              if (Number.isNaN(rawLevel)) continue;
              const clamped = Math.min(trader.maxLevel, Math.max(1, rawLevel));
              next[trader.id] = clamped;
            }

            if (Object.keys(next).length > 0) {
              loaded = next;
            }
          }
        } catch {
        }
      }

      if (!cancelled && loaded) {
        setLevelsById((prev) => ({ ...prev, ...loaded! }));
      }
    }

    void loadTraderStandings();

    return () => {
      cancelled = true;
    };
  }, [traders]);

  useEffect(() => {
    if (!traders.length) return;

    const payload = traders.map((trader) => {
      const level = levelsById[trader.id] ?? trader.level;
      return {
        traderId: trader.id,
        level,
      };
    });

    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem("traderStandings", JSON.stringify(payload));
      } catch {
      }
    }

    (async () => {
      try {
        await fetch("/api/user/progress", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ traderStandings: payload }),
        });
      } catch {
      }
    })();
  }, [levelsById, traders]);

  return (
    <Card className="h-full border-zinc-900/80 bg-zinc-950/90">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-zinc-100">
          Trader standings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 pb-4">
        <div className="space-y-1 rounded-2xl border border-zinc-900/80 bg-zinc-950/80 p-2">
          {sorted.map((trader) => {
            const currentLevel = levelsById[trader.id] ?? trader.level;

            return (
              <div
                key={trader.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-zinc-950/80 px-3 py-2 text-xs text-zinc-200"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950 text-[11px] font-semibold uppercase text-zinc-100">
                    {trader.name.charAt(0)}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-300">
                      {trader.name}
                    </span>
                    <span className="mt-0.5 text-[11px] text-zinc-500">
                      Level {currentLevel} / {trader.maxLevel}
                    </span>
                  </div>
                </div>
                <LevelPills
                  level={currentLevel}
                  maxLevel={trader.maxLevel}
                  onChange={(value) =>
                    setLevelsById((prev) => ({
                      ...prev,
                      [trader.id]: value,
                    }))
                  }
                />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
