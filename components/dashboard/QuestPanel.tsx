"use client";

import { useMemo, useState } from "react";
import type { Quest } from "@/lib/types/quest";
import type { BadgeVariant } from "@/components/ui/Badge";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { cn, percentage } from "@/lib/utils";

type QuestStatus = Quest["status"];

const statusVariant: Record<QuestStatus, BadgeVariant> = {
  completed: "success",
  in_progress: "muted",
  available: "muted",
  locked: "outline",
};

const statusLabel: Record<QuestStatus, string> = {
  completed: "Completed",
  in_progress: "Available",
  available: "Available",
  locked: "Locked",
};

interface QuestPanelProps {
  quests: Quest[];
}

export function QuestPanel({ quests }: QuestPanelProps) {
  const [statusFilter, setStatusFilter] = useState<QuestStatus | "all">(
    "all",
  );

  const sorted = quests
    .slice()
    .sort((a, b) => Number(b.kappaRequired) - Number(a.kappaRequired));

  const filtered = useMemo(() => {
    if (statusFilter === "all") return sorted;

    return sorted.filter((q) => {
      const statusForFilter: QuestStatus =
        q.status === "in_progress" ? "available" : q.status;
      return statusForFilter === statusFilter;
    });
  }, [sorted, statusFilter]);

  const activeCount = quests.filter(
    (q) => q.status === "in_progress" || q.status === "available",
  ).length;

  return (
    <section aria-label="Active quests" className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Active quests
          </h2>
          <div className="flex items-center gap-2 text-[11px] text-zinc-500">
            <span className="inline-flex items-center gap-1 rounded-full bg-zinc-900/80 px-2 py-0.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500/60 opacity-70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              <span>{activeCount} active</span>
            </span>
            <span>{quests.length} total</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 text-[11px]">
          {["all", "available", "completed", "locked"].map((id) => {
            const labelMap: Record<string, string> = {
              all: "All",
              available: "Available",
              completed: "Completed",
              locked: "Locked",
            };

            const active = statusFilter === id;

            return (
              <button
                key={id}
                type="button"
                onClick={() =>
                  setStatusFilter(id === "all" ? "all" : (id as QuestStatus))
                }
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
                <span>{labelMap[id]}</span>
              </button>
            );
          })}
        </div>
      </div>

      <Card className="h-full border-zinc-800/80 bg-zinc-950/80">
        <CardHeader className="pb-1">
          <CardTitle className="text-sm text-zinc-100">Current tasks</CardTitle>
          <CardDescription className="text-[11px] text-zinc-500">
            Focus quests relevant to Kappa and trader unlocks.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 pb-3">
          <div className="flex max-h-80 flex-col gap-2 overflow-y-auto pr-1">
            {filtered.map((quest) => {
              const pct = percentage(
                quest.objectivesCompleted,
                quest.objectivesTotal || 1,
              );

              return (
                <div
                  key={quest.id}
                  className="group rounded-lg border border-zinc-900/80 bg-zinc-950/80 px-3 py-2.5 text-xs transition-colors hover:border-emerald-500/60 hover:bg-zinc-900/90"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <h3 className="truncate text-[13px] font-medium text-zinc-100">
                        {quest.title}
                      </h3>
                      <p className="text-[11px] text-zinc-500">
                        {quest.trader} · {quest.map}
                      </p>
                    </div>
                    <Badge variant={statusVariant[quest.status]}>
                      {statusLabel[quest.status]}
                    </Badge>
                  </div>
                  <div className="mt-2 space-y-1">
                    <ProgressBar value={pct} />
                    <p className="flex items-center justify-between text-[10px] text-zinc-500">
                      <span>
                        {quest.objectivesCompleted}/{quest.objectivesTotal} objectives
                      </span>
                      <span>{pct}%</span>
                    </p>
                  </div>
                </div>
              );
            })}

            {filtered.length === 0 && (
              <p className="text-[11px] text-zinc-500">
                No quests match the current filters. Adjust filters to see more.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
