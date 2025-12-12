"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { QuestStatusBar } from "@/components/dashboard/QuestStatusBar";
import { MapPriorityCard } from "@/components/dashboard/MapPriorityCard";
import { TraderStandingsCard } from "@/components/dashboard/TraderStandingsCard";
import { DashboardNotesCard } from "@/components/dashboard/DashboardNotesCard";
import { ITEMS, TRADERS } from "@/lib/sample-data";
import type { Quest, QuestStatus } from "@/lib/types/quest";
import type { Item } from "@/lib/types/item";
import { Boxes, ClipboardList, Target } from "lucide-react";

interface ItemsSummary {
  totalItems: number;
  totalRequiredUnits: number;
  totalCollectedUnits: number;
  totalRemainingUnits: number;
}

interface DashboardTaskObjective {
  type: string;
  description: string;
  items?: {
    id: string;
    name: string;
    shortName?: string;
    iconLink?: string;
    wikiLink?: string;
  }[];
  count?: number;
  foundInRaid?: boolean;
}

interface DashboardTaskSummary {
  id: string;
  name: string;
  trader: string;
  map: string;
  kappaRequired: boolean;
  status: string | null;
  objectives?: DashboardTaskObjective[];
}

interface DashboardClientProps {
  initialTasks?: DashboardTaskSummary[] | null;
  initialTraderStandings?: { traderId: string; level: number }[] | null;
}

export default function DashboardClient({ initialTasks, initialTraderStandings }: DashboardClientProps) {
  const [questStats, setQuestStats] = useState({
    totalQuests: 0,
    completedQuests: 0,
    totalKappaQuests: 0,
    completedKappaQuests: 0,
  });

  const [notesItems, setNotesItems] = useState<Item[]>(ITEMS);

  const [quests, setQuests] = useState<Quest[]>([]);

  const [kappaItemsSummary, setKappaItemsSummary] = useState<ItemsSummary>({
    totalItems: 0,
    totalRequiredUnits: 0,
    totalCollectedUnits: 0,
    totalRemainingUnits: 0,
  });

  const [questItemsSummary, setQuestItemsSummary] = useState<ItemsSummary>({
    totalItems: 0,
    totalRequiredUnits: 0,
    totalCollectedUnits: 0,
    totalRemainingUnits: 0,
  });

  const [hideoutItemsSummary, setHideoutItemsSummary] = useState<ItemsSummary>({
    totalItems: 0,
    totalRequiredUnits: 0,
    totalCollectedUnits: 0,
    totalRemainingUnits: 0,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadStatsAndItems() {
      try {
        const tasks = Array.isArray(initialTasks) ? initialTasks : [];
        
        // 1. Process Quest Stats & Status
        const statusByQuestId = new Map<string, string>();
        for (const task of tasks) {
          if (!task.id || !task.status) continue;
          statusByQuestId.set(task.id, task.status);
        }

        if (typeof window !== "undefined") {
          try {
            const raw = window.localStorage.getItem("questsProgress");
            if (raw) {
              const data = JSON.parse(raw) as {
                quests?: { questId?: string; status?: string }[];
              };

              if (Array.isArray(data.quests)) {
                for (const entry of data.quests) {
                  if (!entry || !entry.questId || !entry.status) continue;
                  const id = String(entry.questId);
                  const fromPersisted = String(entry.status);
                  const fromServer = statusByQuestId.get(id);

                  if (!fromServer || fromPersisted === "completed") {
                    statusByQuestId.set(id, fromPersisted);
                  }
                }
              }
            }
          } catch {
          }
        }

        // 2. Load Item Progress (Owned counts)
        const ownedByItemId = new Map<string, number>();
        if (typeof window !== "undefined") {
          try {
            const rawProgress = window.localStorage.getItem("hideoutItemsProgress");
            if (rawProgress) {
              const parsed = JSON.parse(rawProgress) as {
                items?: { itemId: string; collected: number }[];
                stationItems?: { stationId: string; levelId: string; itemId: string; collected: number }[];
              };

              if (Array.isArray(parsed.stationItems)) {
                for (const entry of parsed.stationItems) {
                  const val = Number(entry.collected ?? 0) || 0;
                  const existing = ownedByItemId.get(entry.itemId) ?? 0;
                  ownedByItemId.set(entry.itemId, existing + val);
                }
              } else if (Array.isArray(parsed.items)) {
                for (const entry of parsed.items) {
                  const val = Number(entry.collected ?? 0) || 0;
                  ownedByItemId.set(entry.itemId, val);
                }
              }
            }
          } catch {}
        }

        let totalQuests = 0;
        let completedQuests = 0;
        let totalKappaQuests = 0;
        let completedKappaQuests = 0;

        const mappedQuests: Quest[] = [];

        const kappaReqs = new Map<string, number>();
        const questReqs = new Map<string, number>();

        for (const task of tasks) {
          if (!task.id) continue;
          totalQuests += 1;
          if (task.kappaRequired) {
            totalKappaQuests += 1;
          }

          const rawStatus = statusByQuestId.get(task.id);
          let questStatus: QuestStatus = "available";
          if (rawStatus === "completed") {
            questStatus = "completed";
          } else if (rawStatus === "locked") {
            questStatus = "locked";
          }
          if (rawStatus === "started" || rawStatus === "in_progress") {
            questStatus = "in_progress";
          }

          const isCompleted = questStatus === "completed";
          if (isCompleted) {
            completedQuests += 1;
            if (task.kappaRequired) {
              completedKappaQuests += 1;
            }
          }

          const quest: Quest = {
            id: task.id,
            title: task.name,
            trader: task.trader,
            map: task.map,
            status: questStatus,
            objectivesCompleted: 0,
            objectivesTotal: 0,
            reputationReward: 0,
            experienceReward: 0,
            kappaRequired: task.kappaRequired,
          };
          mappedQuests.push(quest);
        }

        for (const task of tasks) {
          if (!task.id) continue;

          const rawStatus = statusByQuestId.get(task.id);
          let questStatus = "available";
          if (rawStatus === "completed") {
            questStatus = "completed";
          } else if (rawStatus === "locked") {
            questStatus = "locked";
          }
          if (rawStatus === "started" || rawStatus === "in_progress") {
            questStatus = "in_progress";
          }

          const isCollector = task.name === "Collector" || task.name === "The Collector";
          const isActive = questStatus === "available" || questStatus === "in_progress";

          if ((isCollector || isActive) && task.objectives) {
            for (const obj of task.objectives) {
              if (!obj.items || obj.items.length === 0) continue;
              for (const itemDef of obj.items) {
                if (!itemDef.id) continue;
                const count = obj.count || 1;

                // Safety clamp: ignore obviously bad counts.
                if (typeof count !== "number" || !Number.isFinite(count) || count <= 0 || count > 100) continue;

                if (isCollector) {
                  const current = kappaReqs.get(itemDef.id) ?? 0;
                  kappaReqs.set(itemDef.id, current + count);
                } else if (isActive) {
                  const current = questReqs.get(itemDef.id) ?? 0;
                  questReqs.set(itemDef.id, current + count);
                }
              }
            }
          }
        }

        const computeSummary = (reqs: Map<string, number>): ItemsSummary => {
          let totalItems = 0;
          let totalRequiredUnits = 0;
          let totalCollectedUnits = 0;

          for (const [itemId, required] of reqs.entries()) {
            totalItems += 1;
            totalRequiredUnits += required;
            const owned = ownedByItemId.get(itemId) ?? 0;
            totalCollectedUnits += Math.min(owned, required);
          }

          return {
            totalItems,
            totalRequiredUnits,
            totalCollectedUnits,
            totalRemainingUnits: Math.max(0, totalRequiredUnits - totalCollectedUnits),
          };
        };

        const newKappaSummary = computeSummary(kappaReqs);
        const newQuestSummary = computeSummary(questReqs);

        if (!cancelled) {
          setQuestStats({ totalQuests, completedQuests, totalKappaQuests, completedKappaQuests });
          setQuests(mappedQuests);
          setKappaItemsSummary(newKappaSummary);
          setQuestItemsSummary(newQuestSummary);

          if (typeof window !== "undefined") {
            window.localStorage.setItem("kappaItemsSummary", JSON.stringify(newKappaSummary));
            window.localStorage.setItem("questItemsSummary", JSON.stringify(newQuestSummary));
          }
        }
      } catch (err) {
        console.error("Dashboard calculation error", err);
      }
    }

    loadStatsAndItems().catch((err) => console.error(err));

    return () => {
      cancelled = true;
    };
  }, [initialTasks]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const rawHideout = window.localStorage.getItem("hideoutItemsSummary");
      if (rawHideout) {
        const data = JSON.parse(rawHideout) as Partial<ItemsSummary>;
        setHideoutItemsSummary({
          totalItems: Number(data.totalItems ?? 0) || 0,
          totalRequiredUnits: Number(data.totalRequiredUnits ?? 0) || 0,
          totalCollectedUnits: Number(data.totalCollectedUnits ?? 0) || 0,
          totalRemainingUnits: Number(data.totalRemainingUnits ?? 0) || 0,
        });
      }
    } catch {
    }

    try {
      const rawIndex = window.localStorage.getItem("dashboardItemsIndex");
      if (rawIndex) {
        const entries = JSON.parse(rawIndex) as { id?: string; name?: string }[];
        const mapped: Item[] = entries
          .filter((entry) => entry && entry.id && entry.name)
          .map((entry) => ({
            id: String(entry.id),
            name: String(entry.name),
            category: "Quest/Hideout" as const,
            rarity: "common" as const,
            neededForKappa: false,
            quantityRequired: 0,
            quantityOwned: 0,
            foundInRaid: false,
          }));

        if (mapped.length > 0) {
          setNotesItems(mapped);
        }
      }
    } catch {
    }
  }, []);

  const totalQuests = questStats.totalQuests;
  const completedQuests = questStats.completedQuests;
  const kappaQuests = questStats.totalKappaQuests;
  const completedKappaQuests = questStats.completedKappaQuests;
  const remainingQuests = Math.max(totalQuests - completedQuests, 0);

  const statCards = [
    {
      label: "Kappa questline",
      value: `${completedKappaQuests}/${kappaQuests}`,
      helperText: "Kappa-required quests completed",
      icon: <ClipboardList className="h-4 w-4" />,
      progress: {
        completed: completedKappaQuests,
        total: kappaQuests || 1,
      },
      trend: "up" as const,
      trendLabel: `+${Math.max(kappaQuests - completedKappaQuests, 0)} quests left`,
    },
    {
      label: "Overall quests",
      value: `${completedQuests}/${totalQuests}`,
      helperText: `${remainingQuests} remaining across all traders`,
      icon: <Target className="h-4 w-4" />,
      trend: "steady" as const,
      trendLabel: `+${Math.max(totalQuests - completedQuests, 0)} quests left`,
    },
    {
      label: "Kappa items",
      value: `${kappaItemsSummary.totalCollectedUnits}/${kappaItemsSummary.totalRequiredUnits}`,
      helperText: "Found in raid for Collector",
      icon: <Boxes className="h-4 w-4" />,
      progress: {
        completed: kappaItemsSummary.totalCollectedUnits,
        total: kappaItemsSummary.totalRequiredUnits || 1,
      },
      trend: "down" as const,
      trendLabel: `+${kappaItemsSummary.totalRemainingUnits} items left`,
    },
    {
      label: "Quest items",
      value: `${questItemsSummary.totalCollectedUnits}/${questItemsSummary.totalRequiredUnits}`,
      helperText: "Quest-critical items tracked",
      icon: <Boxes className="h-4 w-4" />,
      progress: {
        completed: questItemsSummary.totalCollectedUnits,
        total: questItemsSummary.totalRequiredUnits || 1,
      },
      trend: "steady" as const,
      trendLabel: `+${questItemsSummary.totalRemainingUnits} items left`,
    },
    {
      label: "Hideout items",
      value: `${hideoutItemsSummary.totalCollectedUnits}/${hideoutItemsSummary.totalRequiredUnits}`,
      helperText: "Hideout upgrade items tracked",
      icon: <Boxes className="h-4 w-4" />,
      progress: {
        completed: hideoutItemsSummary.totalCollectedUnits,
        total: hideoutItemsSummary.totalRequiredUnits || 1,
      },
      trend: "steady" as const,
      trendLabel: `+${hideoutItemsSummary.totalRemainingUnits} items left`,
    },
  ];

  return (
    <AppShell
      title="Dashboard"
      subtitle="High-level overview of your Kappa run across traders, quests, and items."
    >
      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        {statCards.map((card) => (
          <KpiCard key={card.label} {...card} />
        ))}
      </section>

      <div className="mt-2">
        <QuestStatusBar quests={quests} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <TraderStandingsCard traders={TRADERS} initialStandings={initialTraderStandings ?? undefined} />
        <MapPriorityCard quests={quests} />
        <DashboardNotesCard quests={quests} items={notesItems} />
      </div>
    </AppShell>
  );
}
