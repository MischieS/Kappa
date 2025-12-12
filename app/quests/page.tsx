"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { TRADERS } from "@/lib/sample-data";
import type { GameEdition, Quest, QuestObjectiveSummary, QuestStatus } from "@/lib/types/quest";
import { percentage } from "@/lib/utils";
import { ListChecks, Search, Check, Clock, Lock } from "lucide-react";

const STATUS_FILTERS: { id: Exclude<QuestStatus, "in_progress">; label: string }[] = [
  { id: "available", label: "Available" },
  { id: "completed", label: "Completed" },
  { id: "locked", label: "Locked" },
];

const STATUS_VARIANT: Record<QuestStatus, BadgeVariant> = {
  completed: "success",
  in_progress: "warning",
  available: "muted",
  locked: "outline",
};

const STATUS_LABEL: Record<QuestStatus, string> = {
  completed: "Completed",
  in_progress: "In progress",
  available: "Available",
  locked: "Locked",
};

const REQUIREMENT_FILTERS = [
  { id: "marker", label: "Marker" },
  { id: "jammer", label: "Jammer" },
  { id: "camera", label: "Camera" },
  { id: "item", label: "Item req" },
] as const;

type RequirementFilterId = (typeof REQUIREMENT_FILTERS)[number]["id"];

const TRADER_ICON_URLS: Record<string, string> = {
  Prapor: "/traders/Prapor_Portrait.webp",
  Therapist: "/traders/Therapist_Portrait.webp",
  Skier: "/traders/Skier_Portrait.webp",
  Peacekeeper: "/traders/Peacekeeper_Portrait.webp",
  Mechanic: "/traders/Mechanic_Portrait.webp",
  Ragman: "/traders/Ragman_Portrait.webp",
  Jaeger: "/traders/Jaeger_Portrait.webp",
  Fence: "/traders/Fence_Portrait.webp",
  Ref: "/traders/Ref_Portrait.webp",
  "BTR Driver": "/traders/BTR_Driver_Portrait.webp",
  Lightkeeper: "/traders/Lightkeeper_Portrait.webp",
};

const EOD_ONLY_TASK_TITLES = new Set<string>([
  "Minute of Fame",
  "The Good Times - Part 1",
  "Quality Standard",
  "Key to the City",
  "Serious Allegations",
]);

function getEditionRequirementForTask(title: string): GameEdition | undefined {
  if (EOD_ONLY_TASK_TITLES.has(title)) {
    return "Edge of Darkness";
  }
  return undefined;
}

const FENCE_REP_OVERRIDE_TITLES = [
  { match: "Compensation for Damage", prestige: -1 },
  { match: "Establish Contact", prestige: 4 },
] as const;

function getFencePrestigeOverrideForTask(title: string): number | undefined {
  const normalized = title.toLowerCase();
  for (const entry of FENCE_REP_OVERRIDE_TITLES) {
    if (normalized.includes(entry.match.toLowerCase())) {
      return entry.prestige;
    }
  }
  return undefined;
}

const TASKS_QUERY = `
  query Tasks {
    tasks {
      id
      name
      minPlayerLevel
      requiredPrestige {
        prestigeLevel
      }
      kappaRequired
      lightkeeperRequired
      wikiLink
      taskImageLink
      trader {
        name
      }
      map {
        name
        wiki
        normalizedName
      }
      taskRequirements {
        task {
          id
          name
        }
        status
      }
      traderRequirements {
        requirementType
        compareMethod
        value
        trader {
          name
        }
      }
      objectives {
        id
        type
        description
        maps {
          normalizedName
        }
        ... on TaskObjectiveItem {
          items {
            id
            name
            shortName
          }
          count
          foundInRaid
        }
        ... on TaskObjectiveShoot {
          count
        }
      }
    }
  }
`;

const QUESTS_TASKS_CACHE_KEY = "questsTasksCache-v1";

function applyQuestLocking(
  quests: Quest[],
  options?: {
    playerLevel?: number;
    fenceRep?: number;
    gameEdition?: GameEdition | string;
    traderLevelsByName?: Record<string, number>;
  },
): Quest[] {
  const completedIds = new Set(quests.filter((quest) => quest.status === "completed").map((quest) => quest.id));
  const questById = new Map<string, Quest>();
  for (const quest of quests) {
    questById.set(quest.id, quest);
  }

  return quests.map((quest) => {
    if (quest.status === "completed") {
      return {
        ...quest,
        lockReasons: undefined,
      };
    }

    const previousQuestIds = quest.previousQuestIds;
    const lockReasons: string[] = [];

    if (previousQuestIds && previousQuestIds.length > 0) {
      const missingPrev = previousQuestIds
        .map((id) => questById.get(id))
        .filter((q): q is Quest => Boolean(q))
        .filter((q) => q.status !== "completed");
      if (missingPrev.length > 0) {
        lockReasons.push(...missingPrev.map((q) => q.title));
      }
    }

    if (
      typeof quest.levelRequirement === "number" &&
      options &&
      typeof options.playerLevel === "number" &&
      !Number.isNaN(options.playerLevel) &&
      options.playerLevel < quest.levelRequirement
    ) {
      lockReasons.push(`level ${quest.levelRequirement}`);
    }

    const prestigeOverride = getFencePrestigeOverrideForTask(quest.title);
    const requiredPrestige =
      typeof prestigeOverride === "number" ? prestigeOverride : quest.requiredPrestige;

    if (
      typeof requiredPrestige === "number" &&
      options &&
      typeof options.fenceRep === "number" &&
      !Number.isNaN(options.fenceRep)
    ) {
      const required = requiredPrestige;
      const current = options.fenceRep;

      const meetsPrestige = required >= 0 ? current >= required : current <= required;

      if (!meetsPrestige) {
        lockReasons.push(`Fence rep ${required.toFixed(2)}`);
      }
    }

    if (
      quest.editionRequirement &&
      options &&
      typeof options.gameEdition === "string" &&
      options.gameEdition
    ) {
      const requiredEdition = quest.editionRequirement;
      let meetsEdition = false;

      if (requiredEdition === "Edge of Darkness") {
        if (options.gameEdition === "Edge of Darkness" || options.gameEdition === "Unheard") {
          meetsEdition = true;
        }
      } else {
        meetsEdition = options.gameEdition === requiredEdition;
      }

      if (!meetsEdition) {
        lockReasons.push(`${requiredEdition} edition`);
      }
    }

    if (
      quest.requiredTraderLevels &&
      quest.requiredTraderLevels.length > 0 &&
      options &&
      options.traderLevelsByName
    ) {
      for (const req of quest.requiredTraderLevels) {
        const current = options.traderLevelsByName[req.traderName];
        if (typeof current !== "number" || Number.isNaN(current) || current < req.loyaltyLevel) {
          lockReasons.push(`${req.traderName} LL${req.loyaltyLevel}`);
        }
      }
    }

    if (lockReasons.length > 0) {
      return {
        ...quest,
        status: "locked",
        lockReasons,
      };
    }

    return {
      ...quest,
      status: "available",
      lockReasons: undefined,
    };
  });
}

function QuestsContent() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]["id"]>("available");
  const [traderFilter, setTraderFilter] = useState<string>("all");
  const [showKappaOnly, setShowKappaOnly] = useState(false);
  const [showLightkeeperOnly, setShowLightkeeperOnly] = useState(false);
  const [requirementFilters, setRequirementFilters] = useState<RequirementFilterId[]>([]);
  const [showRequirementList, setShowRequirementList] = useState(false);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedQuestId, setExpandedQuestId] = useState<string | null>(null);
  const [savingObjectivesFor, setSavingObjectivesFor] = useState<string | null>(null);
  const [questsHydratedFromStorage, setQuestsHydratedFromStorage] = useState(false);
  const [pendingScrollTargetId, setPendingScrollTargetId] = useState<string | null>(null);
  const questRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [playerLevel, setPlayerLevel] = useState<number | null>(null);
  const [playerFenceRep, setPlayerFenceRep] = useState<number | null>(null);
  const [playerEdition, setPlayerEdition] = useState<GameEdition | null>(null);
  const [traderLevelsByName, setTraderLevelsByName] = useState<Record<string, number> | null>(null);
  const [teamProgress, setTeamProgress] = useState<
    | {
        teamId: string;
        teamName: string | null;
        members: {
          userId: string;
          username: string | null;
          role: string | null;
          quests: { questId: string; status: QuestStatus }[];
        }[];
      }
    | null
  >(null);
  const [teamProgressLoading, setTeamProgressLoading] = useState(false);
  const [teamProgressError, setTeamProgressError] = useState<string | null>(null);
  const [canSyncToServer, setCanSyncToServer] = useState(false);

  function persistQuestsProgress(questsToPersist: Quest[]) {
    if (typeof window === "undefined") return;

    if (!questsToPersist || questsToPersist.length === 0) {
      try {
        window.localStorage.removeItem("questsProgress");
      } catch {
        // ignore localStorage errors
      }
      return;
    }

    try {
      const questsPayload = questsToPersist.map((quest) => ({
        questId: quest.id,
        status: quest.status,
      }));

      const objectivesPayload: { questId: string; objectiveId: string; collected: number }[] = [];
      for (const quest of questsToPersist) {
        if (!quest.objectives) continue;
        for (const obj of quest.objectives) {
          const collected = obj.collectedCount ?? 0;
          if (!collected) continue;
          objectivesPayload.push({ questId: quest.id, objectiveId: obj.id, collected });
        }
      }

      const payload = JSON.stringify({ quests: questsPayload, objectives: objectivesPayload });
      window.localStorage.setItem("questsProgress", payload);
    } catch {
      // ignore localStorage errors
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadTasks() {
      setLoading(true);
      setError(null);

      try {
        let rawTasks: any[] | null = null;

        if (typeof window !== "undefined") {
          try {
            const rawCache = window.localStorage.getItem(QUESTS_TASKS_CACHE_KEY);
            if (rawCache) {
              const parsed = JSON.parse(rawCache) as { updatedAt?: number; tasks?: any[] };
              if (Array.isArray(parsed.tasks)) {
                rawTasks = parsed.tasks;
              }
            }
          } catch {
            // ignore malformed cache
          }
        }

        if (!rawTasks) {
          const response = await fetch("/api/tarkov", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: TASKS_QUERY }),
          });

          const result = await response.json().catch(() => null);

          const graphqlErrorMessage =
            result && Array.isArray(result.errors) && result.errors.length > 0
              ? result.errors
                  .map((err: any) => String(err?.message ?? "").trim())
                  .filter(Boolean)
                  .join("; ")
              : null;

          if (!response.ok || !result || !result.data || !Array.isArray(result.data.tasks)) {
            console.error("tarkov.dev tasks error", { status: response.status, result });
            setError(graphqlErrorMessage || "Failed to load quests from tarkov.dev");
            setLoading(false);
            return;
          }

          rawTasks = result.data.tasks as any[];

          if (typeof window !== "undefined") {
            try {
              window.localStorage.setItem(
                QUESTS_TASKS_CACHE_KEY,
                JSON.stringify({ updatedAt: Date.now(), tasks: rawTasks }),
              );
            } catch {
              // ignore localStorage errors
            }
          }
        }

        const rawTasksNonNull: any[] = rawTasks ?? [];

        const mappedFromApi: Quest[] = rawTasksNonNull.map((task: any): Quest => {
          const allObjectiveMaps: string[] = Array.isArray(task.objectives)
            ? task.objectives
                .flatMap((objective: any) => objective?.maps || [])
                .map((map: any) => String(map?.normalizedName || ""))
                .filter(Boolean)
            : [];
          const primaryMap = allObjectiveMaps[0] ?? "Any";

          const mapName = task.map?.name ? String(task.map.name) : primaryMap;

          const requirementTagsSet = new Set<RequirementFilterId>();
          const requiredItemsFir: string[] = [];
          const requiredItemsNonFir: string[] = [];
          const requiredEquipment: string[] = [];
          const requiredKeys: string[] = [];
          const objectivesSummaries: QuestObjectiveSummary[] = [];

          if (Array.isArray(task.objectives)) {
            for (const objective of task.objectives) {
              const rawDescription = String(objective?.description ?? "");
              const description = rawDescription.toLowerCase();
              let isKeyObjective = false;

              const isItemObjective =
                objective && Array.isArray(objective.items) && objective.items.length > 0;

              if (isItemObjective) {
                const count: number | undefined =
                  typeof objective.count === "number" && !Number.isNaN(objective.count)
                    ? objective.count
                    : undefined;

                const baseNames: string[] = [];
                if (Array.isArray(objective.items)) {
                  for (const it of objective.items as any[]) {
                    if (!it || typeof it !== "object") continue;
                    baseNames.push(
                      String(
                        (it.shortName as string | undefined) ||
                          (it.name as string | undefined) ||
                          "Item",
                      ),
                    );
                  }
                }

                const name = baseNames.filter(Boolean).join(", ") || "Item";
                const line = count ? `${count}x ${name}` : name;

                if (objective.foundInRaid) {
                  requiredItemsFir.push(line);
                } else {
                  requiredItemsNonFir.push(line);
                }

                requirementTagsSet.add("item");
              }

              if (description.includes("mark") || description.includes("marker") || description.includes("signal")) {
                requirementTagsSet.add("marker");
              }
              if (description.includes("jammer")) {
                requirementTagsSet.add("jammer");
              }
              if (description.includes("camera")) {
                requirementTagsSet.add("camera");
              }

              if (description.includes(" key")) {
                requiredKeys.push(rawDescription || "Key objective");
                isKeyObjective = true;
              }

              if (
                description.includes("helmet") ||
                description.includes("vest") ||
                description.includes("armband") ||
                description.includes("wear ")
              ) {
                requiredEquipment.push(rawDescription || "Equipment objective");
              }

              const objectiveId = String(objective?.id ?? `${task.id}-${objectivesSummaries.length}`);

              const rawRequiredCount =
                typeof objective.count === "number" &&
                !Number.isNaN(objective.count) &&
                objective.count > 0
                  ? objective.count
                  : undefined;

              const summary: QuestObjectiveSummary = {
                id: objectiveId,
                description: rawDescription || "Objective",
                requiredCount: rawRequiredCount ?? 1,
                isKeyObjective: isKeyObjective || undefined,
                requiresFir: Boolean(isItemObjective && objective.foundInRaid),
              };

              objectivesSummaries.push(summary);
            }
          }

          const requirementTags =
            requirementTagsSet.size > 0 ? (Array.from(requirementTagsSet) as RequirementFilterId[]) : undefined;

          const previousQuestIds: string[] = Array.isArray(task.taskRequirements)
            ? task.taskRequirements
                .map((req: any) => req?.task?.id)
                .filter((id: unknown): id is string => typeof id === "string")
            : [];

          const levelRequirement =
            typeof task.minPlayerLevel === "number" && !Number.isNaN(task.minPlayerLevel)
              ? task.minPlayerLevel
              : undefined;

          const title = String(task.name ?? "Unknown task");
          const editionRequirement = getEditionRequirementForTask(title);

          let requiredPrestige =
            task.requiredPrestige &&
            typeof task.requiredPrestige.prestigeLevel === "number" &&
            !Number.isNaN(task.requiredPrestige.prestigeLevel)
              ? task.requiredPrestige.prestigeLevel
              : undefined;

          const overriddenPrestige = getFencePrestigeOverrideForTask(title);
          if (typeof overriddenPrestige === "number") {
            requiredPrestige = overriddenPrestige;
          }

          const requiredTraderLevels: { traderName: string; loyaltyLevel: number }[] = [];
          if (Array.isArray(task.traderRequirements)) {
            for (const requirement of task.traderRequirements as any[]) {
              if (!requirement || requirement.requirementType !== "loyaltyLevel") continue;

              const rawName = requirement.trader?.name;
              const traderName =
                typeof rawName === "string" && rawName.trim().length > 0 ? rawName.trim() : undefined;
              const rawValue = Number(requirement.value);

              if (!traderName || Number.isNaN(rawValue) || rawValue <= 0) continue;

              requiredTraderLevels.push({
                traderName,
                loyaltyLevel: rawValue,
              });
            }
          }

          const quest: Quest = {
            id: String(task.id),
            title,
            trader: String(task.trader?.name ?? "Unknown trader"),
            map: mapName,
            levelRequirement,
            editionRequirement,
            status: "available",
            objectivesCompleted: 0,
            objectivesTotal: Array.isArray(task.objectives) ? task.objectives.length : 0,
            reputationReward: 0,
            experienceReward: 0,
            kappaRequired: Boolean(task.kappaRequired),
            requiredKeys: requiredKeys.length > 0 ? requiredKeys : undefined,
            requirementTags,
            lightkeeperRequired: Boolean(task.lightkeeperRequired),
            requiredItemsFir: requiredItemsFir.length > 0 ? requiredItemsFir : undefined,
            requiredItemsNonFir: requiredItemsNonFir.length > 0 ? requiredItemsNonFir : undefined,
            requiredEquipment: requiredEquipment.length > 0 ? requiredEquipment : undefined,
            objectives: objectivesSummaries.length > 0 ? objectivesSummaries : undefined,
            wikiLink: task.wikiLink || undefined,
            taskImageLink: task.taskImageLink || undefined,
            mapWikiLink: task.map?.wiki || undefined,
            previousQuestIds: previousQuestIds.length > 0 ? previousQuestIds : undefined,
            requiredPrestige,
            requiredTraderLevels: requiredTraderLevels.length > 0 ? requiredTraderLevels : undefined,
          };
          return quest;
        });

        // Build a lookup of which quests this task unlocks (next quests)
        const nextByQuestId = new Map<string, Set<string>>();

        for (const task of rawTasksNonNull) {
          if (!Array.isArray(task.taskRequirements)) continue;
          for (const req of task.taskRequirements) {
            const prevId = req?.task?.id;
            if (!prevId || typeof prevId !== "string") continue;
            const set = nextByQuestId.get(prevId) ?? new Set<string>();
            set.add(String(task.id));
            nextByQuestId.set(prevId, set);
          }
        }

        let mapped: Quest[] = mappedFromApi.map((quest) => {
          const nextIdsSet = nextByQuestId.get(quest.id);
          const nextQuestIds = nextIdsSet ? Array.from(nextIdsSet) : quest.nextQuestIds;
          return {
            ...quest,
            nextQuestIds: nextQuestIds && nextQuestIds.length > 0 ? nextQuestIds : undefined,
          };
        });

        let userLevel: number | undefined;
        let userFenceRep: number | undefined;
        let userEdition: GameEdition | undefined;
        let traderLevels: Record<string, number> | null = null;

        try {
          const progressResponse = await fetch("/api/user/progress", {
            method: "GET",
            credentials: "include",
          });

          if (progressResponse.ok) {
            const progress = await progressResponse.json().catch(() => null);
            const statusByQuestId = new Map<string, string>();
            const objectiveProgressByQuestId = new Map<string, { objectiveId: string; collected: number }[]>();

            if (progress && typeof progress.gameEdition === "string") {
              userEdition = progress.gameEdition as GameEdition;
              setPlayerEdition(userEdition);
            }

            if (progress && typeof progress.level === "number" && !Number.isNaN(progress.level)) {
              userLevel = progress.level;
              setPlayerLevel(progress.level);
            }

            if (progress && typeof progress.fenceRep === "number" && !Number.isNaN(progress.fenceRep)) {
              userFenceRep = progress.fenceRep;
              setPlayerFenceRep(progress.fenceRep);
            }

            if (progress && Array.isArray(progress.quests)) {
              for (const qp of progress.quests as any[]) {
                if (!qp || !qp.questId || !qp.status) continue;
                statusByQuestId.set(String(qp.questId), String(qp.status));
              }
            }

            if (progress && Array.isArray(progress.objectives)) {
              for (const op of progress.objectives as any[]) {
                if (!op || !op.questId || !op.objectiveId) continue;
                const questId = String(op.questId);
                const list = objectiveProgressByQuestId.get(questId) ?? [];
                list.push({ objectiveId: String(op.objectiveId), collected: Number(op.collected ?? 0) });
                objectiveProgressByQuestId.set(questId, list);
              }
            }

            if (progress && Array.isArray(progress.traderStandings)) {
              const byName: Record<string, number> = {};
              for (const standing of progress.traderStandings as any[]) {
                if (!standing || !standing.traderId) continue;
                const trader = TRADERS.find((t) => t.id === String(standing.traderId));
                if (!trader) continue;
                const rawLevel = Number((standing.level as number | undefined) ?? trader.level);
                if (Number.isNaN(rawLevel)) continue;
                const clamped = Math.min(trader.maxLevel, Math.max(1, rawLevel));
                byName[trader.name] = clamped;
              }
              if (Object.keys(byName).length > 0) {
                traderLevels = byName;
              }
            }

            setCanSyncToServer(true);
          }
        } catch {
          // Ignore errors from user progress; fall back to API-only data
        }

        if (userLevel === undefined || userFenceRep === undefined || userEdition === undefined) {
          try {
            if (typeof window !== "undefined") {
              const rawSettings = window.localStorage.getItem("kappaPlayerSettings");
              if (rawSettings) {
                const data = JSON.parse(rawSettings) as {
                  level?: number;
                  fenceRep?: number;
                  edition?: GameEdition | string;
                };

                if (userLevel === undefined && typeof data.level === "number" && !Number.isNaN(data.level)) {
                  userLevel = data.level;
                  setPlayerLevel(data.level);
                }

                if (
                  userFenceRep === undefined &&
                  typeof data.fenceRep === "number" &&
                  !Number.isNaN(data.fenceRep)
                ) {
                  userFenceRep = data.fenceRep;
                  setPlayerFenceRep(data.fenceRep);
                }

                if (userEdition === undefined && typeof data.edition === "string") {
                  userEdition = data.edition as GameEdition;
                  setPlayerEdition(userEdition);
                }
              }
            }
          } catch {
            // ignore localStorage errors
          }
        }

        mapped = applyQuestLocking(mapped, {
          playerLevel: userLevel,
          fenceRep: userFenceRep,
          gameEdition: userEdition,
          traderLevelsByName: traderLevels ?? undefined,
        });

        if (traderLevels) {
          setTraderLevelsByName(traderLevels);
        }

        if (!cancelled) {
          // On initial load we only set quests from tarkov.dev and rely on
          // the client-side hydration effect + explicit user actions to
          // persist quest progress. This prevents overwriting local
          // progress (stored in localStorage) when /api/user/progress is
          // unavailable.
          setQuests(mapped);
        }
      } catch {
        if (!cancelled) {
          setError("Failed to load quests from tarkov.dev");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadTasks();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadTeamProgress() {
      setTeamProgressLoading(true);
      setTeamProgressError(null);

      try {
        const teamsRes = await fetch("/api/teams", {
          method: "GET",
          credentials: "include",
        });

        if (!teamsRes.ok) {
          if (teamsRes.status === 401) {
            return;
          }
          return;
        }

        const teamsJson = (await teamsRes.json().catch(() => null)) as
          | { teams?: { id: string; name?: string }[] }
          | null;
        const teams = teamsJson && Array.isArray(teamsJson.teams) ? teamsJson.teams : [];

        if (!teams.length) return;

        const activeTeam = teams[0];

        const progressRes = await fetch(`/api/teams/${activeTeam.id}/quests`, {
          method: "GET",
          credentials: "include",
        });

        if (!progressRes.ok) {
          const data = await progressRes.json().catch(() => null);
          const message = (data && (data.error as string)) || "Failed to load team quest progress";
          setTeamProgressError(message);
          return;
        }

        const progress = (await progressRes.json().catch(() => null)) as
          | {
              teamId?: string;
              members?: {
                userId?: string;
                username?: string | null;
                role?: string | null;
                quests?: { questId?: string; status?: string }[];
              }[];
            }
          | null;

        if (!progress || !progress.teamId || !Array.isArray(progress.members)) return;

        if (cancelled) return;

        setTeamProgress({
          teamId: progress.teamId,
          teamName: activeTeam.name ?? null,
          members: progress.members
            .map((member) => ({
              userId: String(member.userId ?? ""),
              username: member.username ?? null,
              role: member.role ?? null,
              quests:
                Array.isArray(member.quests)
                  ? member.quests
                      .filter((q) => q && q.questId && q.status)
                      .map((q) => ({
                        questId: String(q.questId),
                        status: String(q.status) as QuestStatus,
                      }))
                  : [],
            }))
            .filter((member) => member.userId),
        });
      } catch {
        if (!cancelled) {
          setTeamProgressError("Failed to load team quest progress");
        }
      } finally {
        if (!cancelled) {
          setTeamProgressLoading(false);
        }
      }
    }

    void loadTeamProgress();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    function handleSettingsChanged(event: Event) {
      const custom = event as CustomEvent<{
        level?: number;
        fenceRep?: number;
        edition?: GameEdition | string;
      }>;
      const detail = custom.detail;
      if (!detail) return;

      if (typeof detail.level === "number" && !Number.isNaN(detail.level)) {
        setPlayerLevel(detail.level);
      }

      if (typeof detail.fenceRep === "number" && !Number.isNaN(detail.fenceRep)) {
        setPlayerFenceRep(detail.fenceRep);
      }

      if (typeof detail.edition === "string") {
        setPlayerEdition(detail.edition as GameEdition);
      }
    }

    window.addEventListener("kappaPlayerSettingsChanged", handleSettingsChanged as EventListener);

    return () => {
      window.removeEventListener("kappaPlayerSettingsChanged", handleSettingsChanged as EventListener);
    };
  }, []);

  const traderOptions = useMemo(() => {
    const ordered = TRADERS.map((trader) => trader.name);
    const extraFromQuests = Array.from(
      new Set(quests.map((quest) => quest.trader).filter((name) => !ordered.includes(name))),
    );
    return ["all", ...ordered, ...extraFromQuests];
  }, [quests]);

  const traderQuestStats = useMemo(() => {
    const stats = new Map<string, { completed: number; total: number }>();
    for (const quest of quests) {
      const prev = stats.get(quest.trader) ?? { completed: 0, total: 0 };
      prev.total += 1;
      if (quest.status === "completed") prev.completed += 1;
      stats.set(quest.trader, prev);
    }
    const all = {
      completed: Array.from(stats.values()).reduce((sum, value) => sum + value.completed, 0),
      total: quests.length,
    };
    return { stats, all };
  }, [quests]);

  const overallQuestStats = useMemo(() => {
    const scopedQuests = quests.filter((quest) => {
      if (showKappaOnly || showLightkeeperOnly) {
        const isKappa = quest.kappaRequired;
        const isLightkeeper = quest.lightkeeperRequired;

        const matchesKappa = showKappaOnly && isKappa;
        const matchesLightkeeper = showLightkeeperOnly && isLightkeeper;

        if (!matchesKappa && !matchesLightkeeper) {
          return false;
        }
      }

      return true;
    });

    const totalQuests = scopedQuests.length;
    const completedQuests = scopedQuests.filter((quest) => quest.status === "completed").length;
    const remainingQuests = Math.max(totalQuests - completedQuests, 0);

    return {
      totalQuests,
      completedQuests,
      remainingQuests,
    };
  }, [quests, showKappaOnly, showLightkeeperOnly]);

  useEffect(() => {
    setQuests((prev) =>
      applyQuestLocking(prev, {
        playerLevel: playerLevel ?? undefined,
        fenceRep: playerFenceRep ?? undefined,
        gameEdition: playerEdition ?? undefined,
        traderLevelsByName: traderLevelsByName ?? undefined,
      }),
    );
  }, [playerLevel, playerFenceRep, playerEdition, traderLevelsByName]);

  const filtered = useMemo(
    () => {
      const normalizedQuery = query.trim().toLowerCase();

      return quests.filter((quest) => {
        const statusForFilter: Exclude<QuestStatus, "in_progress"> =
          quest.status === "in_progress" ? "available" : quest.status;

        if (statusForFilter !== status) return false;

        if (showKappaOnly || showLightkeeperOnly) {
          const isKappa = quest.kappaRequired;
          const isLightkeeper = quest.lightkeeperRequired;

          const matchesKappa = showKappaOnly && isKappa;
          const matchesLightkeeper = showLightkeeperOnly && isLightkeeper;

          if (!matchesKappa && !matchesLightkeeper) {
            return false;
          }
        }

        if (traderFilter !== "all" && quest.trader !== traderFilter) return false;

        if (requirementFilters.length > 0) {
          const tags = quest.requirementTags ?? [];
          if (!tags.some((tag) => requirementFilters.includes(tag as RequirementFilterId))) {
            return false;
          }
        }

        if (!normalizedQuery) return true;

        const haystack = `${quest.title} ${quest.trader} ${quest.map}`.toLowerCase();
        return haystack.includes(normalizedQuery);
      });
    },
    [
      query,
      status,
      traderFilter,
      requirementFilters,
      showKappaOnly,
      showLightkeeperOnly,
      quests,
    ],
  );

  useEffect(() => {
    if (!pendingScrollTargetId) return;
    if (typeof window === "undefined") return;

    const target = questRefs.current[pendingScrollTargetId];
    if (target) {
      const rect = target.getBoundingClientRect();
      const offset = window.scrollY + rect.top - 140;
      window.scrollTo({ top: offset, behavior: "smooth" });
      setExpandedQuestId(pendingScrollTargetId);
    }

    setPendingScrollTargetId(null);
  }, [pendingScrollTargetId]);

  useEffect(() => {
    const targetId = searchParams?.get("questId");
    if (targetId) {
      setPendingScrollTargetId(targetId);
    }
  }, [searchParams]);

  async function handleToggleCompleted(quest: Quest) {
    const questId = quest.id;
    const currentlyCompleted = quest.status === "completed";
    const nextStatus: QuestStatus = currentlyCompleted ? "available" : "completed";

    setSavingObjectivesFor(questId);
    const objectivesPayload =
      !currentlyCompleted && quest.objectives
        ? quest.objectives
            .filter((objective) =>
              typeof objective.requiredCount === "number" && objective.requiredCount > 0,
            )
            .map((objective) => ({
              questId,
              objectiveId: objective.id,
              collected: objective.requiredCount as number,
            }))
        : undefined;

    try {
      if (canSyncToServer) {
        try {
          await fetch("/api/user/progress", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              quests: [
                {
                  questId,
                  status: nextStatus,
                },
              ],
              ...(objectivesPayload
                ? {
                    objectives: objectivesPayload,
                  }
                : {}),
            }),
          });
        } catch {
          // ignore server errors for anonymous or flaky sessions
        }
      }

      setQuests((prev) => {
        const updated = prev.map((existing) => {
          if (existing.id !== questId) return existing;

          const updatedObjectives = existing.objectives
            ? existing.objectives.map((objective) => {
                if (
                  typeof objective.requiredCount === "number" &&
                  objective.requiredCount > 0
                ) {
                  // When marking completed, set collectedCount to requiredCount.
                  // When unmarking, reset collectedCount to 0 so progress
                  // matches the quest status.
                  const collectedCount = currentlyCompleted
                    ? 0
                    : objective.requiredCount;
                  return {
                    ...objective,
                    collectedCount,
                  };
                }
                return objective;
              })
            : existing.objectives;

          const totalObjectives = existing.objectivesTotal || 0;
          const completedObjectives =
            nextStatus === "completed"
              ? totalObjectives
              : updatedObjectives && totalObjectives > 0
                ? updatedObjectives.filter((objective) => {
                    if (
                      typeof objective.requiredCount === "number" &&
                      objective.requiredCount > 0
                    ) {
                      return (objective.collectedCount ?? 0) >= objective.requiredCount;
                    }
                    return false;
                  }).length
                : 0;

          return {
            ...existing,
            status: nextStatus,
            objectives: updatedObjectives,
            objectivesCompleted: completedObjectives,
          };
        });

        const locked = applyQuestLocking(updated, {
          playerLevel: playerLevel ?? undefined,
          fenceRep: playerFenceRep ?? undefined,
          gameEdition: playerEdition ?? undefined,
          traderLevelsByName: traderLevelsByName ?? undefined,
        });
        persistQuestsProgress(locked);
        return locked;
      });
    } finally {
      setSavingObjectivesFor(null);
    }
  }

  // One-time client-side hydration from persisted questsProgress (in case
  // /api/user/progress is failing with 401). This runs after quests have
  // been loaded from tarkov.dev and merges any stored completion/objective
  // counts into the in-memory quests state.
  useEffect(() => {
    if (questsHydratedFromStorage) return;
    if (typeof window === "undefined") return;
    if (quests.length === 0) return;

    let persistedRaw: string | null = null;

    try {
      persistedRaw = window.localStorage.getItem("questsProgress");
    } catch {
      // ignore localStorage errors
    }

    if (!persistedRaw) {
      setQuestsHydratedFromStorage(true);
      return;
    }

    try {
      const data = JSON.parse(persistedRaw) as {
        quests?: { questId?: string; status?: string }[];
        objectives?: { questId?: string; objectiveId?: string; collected?: number }[];
      };

      if (!data.quests && !data.objectives) {
        setQuestsHydratedFromStorage(true);
        return;
      }

      setQuests((prev) => {
        if (!prev || prev.length === 0) return prev;

        const statusByQuestId = new Map<string, QuestStatus>();
        const collectedByQuestId = new Map<string, Map<string, number>>();

        if (Array.isArray(data.quests)) {
          for (const entry of data.quests) {
            if (!entry || !entry.questId || !entry.status) continue;
            const questId = String(entry.questId);
            const status = String(entry.status) as QuestStatus;
            const existing = statusByQuestId.get(questId);

            // Prefer completed over any other status.
            if (!existing || status === "completed") {
              statusByQuestId.set(questId, status);
            }
          }
        }

        if (Array.isArray(data.objectives)) {
          for (const entry of data.objectives) {
            if (!entry || !entry.questId || !entry.objectiveId) continue;
            const questId = String(entry.questId);
            const objectiveId = String(entry.objectiveId);
            const collectedRaw = Number(entry.collected ?? 0);
            const collected = Number.isNaN(collectedRaw) ? 0 : collectedRaw;
            if (!collected) continue;

            const byObjective = collectedByQuestId.get(questId) ?? new Map<string, number>();
            const existing = byObjective.get(objectiveId) ?? 0;
            byObjective.set(objectiveId, Math.max(existing, collected));
            collectedByQuestId.set(questId, byObjective);
          }
        }

        return prev.map((quest) => {
          const persistedStatus = statusByQuestId.get(quest.id);
          const byObjective = collectedByQuestId.get(quest.id);

          let objectives = quest.objectives;
          if (objectives && byObjective) {
            objectives = objectives.map((obj) => {
              const extra = byObjective?.get(obj.id) ?? 0;
              const nextCollected = Math.max(obj.collectedCount ?? 0, extra);
              return {
                ...obj,
                collectedCount: nextCollected,
              };
            });
          }

          let status = quest.status;
          if (persistedStatus) {
            if (persistedStatus === "completed") status = "completed";
            else if (status !== "completed") status = persistedStatus;
          }

          const objectivesTotal = quest.objectivesTotal || (objectives ? objectives.length : 0);
          const objectivesCompleted =
            status === "completed" && objectivesTotal > 0
              ? objectivesTotal
              : objectives && objectivesTotal > 0
                ? objectives.filter((obj) => {
                    if (
                      typeof obj.requiredCount === "number" &&
                      obj.requiredCount > 0
                    ) {
                      return (obj.collectedCount ?? 0) >= obj.requiredCount;
                    }
                    return false;
                  }).length
                : quest.objectivesCompleted || 0;

          return {
            ...quest,
            status,
            objectives,
            objectivesCompleted,
            objectivesTotal,
          };
        });
      });
    } catch {
      // ignore malformed persisted data
    }

    setQuestsHydratedFromStorage(true);
  }, [quests, questsHydratedFromStorage]);

  async function handleObjectiveCountChange(
    quest: Quest,
    objective: QuestObjectiveSummary,
    collected: number,
  ) {
    const clamped = Math.max(0, Math.min(collected, objective.requiredCount ?? collected));

    const optimisticObjectives = (quest.objectives ?? []).map((obj) =>
      obj.id === objective.id
        ? {
            ...obj,
            collectedCount: clamped,
          }
        : obj,
    );

    setQuests((prev) => {
      const updated = prev.map((q) => (q.id === quest.id ? { ...q, objectives: optimisticObjectives } : q));
      persistQuestsProgress(updated);
      return updated;
    });

    setSavingObjectivesFor(quest.id);
    try {
      if (canSyncToServer) {
        try {
          await fetch("/api/user/progress", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              objectives: [
                {
                  questId: quest.id,
                  objectiveId: objective.id,
                  collected: clamped,
                },
              ],
            }),
          });
        } catch {
          // ignore server errors for anonymous or flaky sessions
        }
      }
    } finally {
      setSavingObjectivesFor(null);
    }
  }

  return (
    <AppShell
      title="Quests"
      subtitle="Filter quests by status and inspect details for your Kappa push."
    >
      <section className="space-y-4">
        {/* Quest giver cards grid */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {traderOptions.map((trader) => {
            const isAll = trader === "all";
            const label = isAll ? "All traders" : trader;
            const active = traderFilter === trader;

            const stats = isAll
              ? traderQuestStats.all
              : traderQuestStats.stats.get(trader) ?? { completed: 0, total: 0 };

            const iconUrl = !isAll ? TRADER_ICON_URLS[label] : undefined;

            return (
              <button
                key={trader}
                type="button"
                onClick={() => setTraderFilter(trader)}
                className={[
                  "flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left text-[11px] transition-colors",
                  active
                    ? "border-emerald-500/80 bg-emerald-500/15 text-emerald-100"
                    : "border-zinc-800/80 bg-zinc-950/80 text-zinc-300 hover:border-zinc-600/80",
                ].join(" ")}
              >
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-zinc-800/80">
                  {iconUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={iconUrl}
                      alt={label}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-[10px] text-zinc-500">ALL</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-medium text-zinc-100">{label}</p>
                  <p className="text-[10px] text-zinc-500">
                    {stats.completed}/{stats.total} completed
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="w-full md:max-w-lg lg:max-w-xl">
            <div className="flex items-center gap-2 rounded-lg border border-zinc-800/80 bg-zinc-950/80 px-3 py-1.5 text-sm text-zinc-100 focus-within:border-emerald-500/60 focus-within:ring-1 focus-within:ring-emerald-500/40">
              <Search className="h-3.5 w-3.5 text-zinc-500" />
              <input
                placeholder="Search by quest, trader, or map"
                className="h-7 w-full bg-transparent text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs md:justify-end">
            {/* Status filter */}
            <div className="flex flex-wrap gap-1.5">
              {STATUS_FILTERS.map((filter) => (
                <Button
                  key={filter.id}
                  variant={status === filter.id ? "primary" : "ghost"}
                  size="sm"
                  onClick={() => setStatus(filter.id)}
                  className="rounded-full px-3 text-[11px]"
                >
                  {filter.label}
                </Button>
              ))}
            </div>

            {/* Quest type filter: togglable Kappa / Lightkeeper */}
            <div className="flex flex-wrap gap-1.5">
              <Button
                variant={showKappaOnly ? "primary" : "ghost"}
                size="sm"
                onClick={() => setShowKappaOnly((prev) => !prev)}
                className="rounded-full px-3 text-[11px]"
              >
                Kappa
              </Button>
              <Button
                variant={showLightkeeperOnly ? "primary" : "ghost"}
                size="sm"
                onClick={() => setShowLightkeeperOnly((prev) => !prev)}
                className="rounded-full px-3 text-[11px]"
              >
                Lightkeeper
              </Button>
            </div>

            {/* Requirement type filter: button + inline list */}
            <div className="flex flex-col items-stretch gap-1.5">
              <div className="flex justify-end w-full">
                <Button
                  type="button"
                  variant={requirementFilters.length > 0 ? "primary" : "ghost"}
                  size="sm"
                  onClick={() => setShowRequirementList((prev) => !prev)}
                  className="rounded-full px-3 text-[11px]"
                >
                  Req: {requirementFilters.length === 0 ? "All" : `${requirementFilters.length} selected`}
                </Button>
              </div>
              {showRequirementList ? (
                <div className="mt-1 w-full max-w-xs rounded-lg border border-zinc-800/80 bg-zinc-950/95 px-3 py-2 text-[11px] text-zinc-200">
                  <div className="flex items-center justify-between pb-1">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-3 w-3 rounded border-zinc-700 bg-zinc-950 text-emerald-500"
                        checked={requirementFilters.length === 0}
                        onChange={() => setRequirementFilters([])}
                      />
                      <span>All</span>
                    </label>
                  </div>
                  <div className="space-y-1">
                    {REQUIREMENT_FILTERS.map((filter) => {
                      const active = requirementFilters.includes(filter.id);
                      return (
                        <label
                          key={filter.id}
                          className="flex items-center justify-between gap-2"
                        >
                          <span>{filter.label}</span>
                          <input
                            type="checkbox"
                            className="h-3 w-3 rounded border-zinc-700 bg-zinc-950 text-emerald-500"
                            checked={active}
                            onChange={() =>
                              setRequirementFilters((prev) =>
                                prev.includes(filter.id)
                                  ? prev.filter((id) => id !== filter.id)
                                  : [...prev, filter.id],
                              )
                            }
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <Card className="border border-zinc-800/80 bg-zinc-950/80">
          <CardHeader className="flex items-center gap-2 pb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-300">
              <ListChecks className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
                Quest overview
              </CardTitle>
              <CardDescription className="text-[11px] text-emerald-100/80">
                {overallQuestStats.totalQuests} quests · {overallQuestStats.remainingQuests}/
                {overallQuestStats.totalQuests} remaining
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <ProgressBar
              value={percentage(overallQuestStats.completedQuests, overallQuestStats.totalQuests || 1)}
              showLabel
            />
            <p className="text-[11px] text-emerald-100/80">
              {overallQuestStats.completedQuests}/{overallQuestStats.totalQuests || 0} quests completed
            </p>
          </CardContent>
        </Card>
        <div className="space-y-2">
          {loading ? (
            <p className="text-xs text-zinc-500">Loading quests from tarkov.dev…</p>
          ) : null}
          {error ? (
            <p className="text-xs text-rose-400">{error}</p>
          ) : null}
          {!loading && !error && quests.length === 0 ? (
            <p className="text-xs text-zinc-500">No quests loaded from tarkov.dev.</p>
          ) : null}
          
          {filtered.map((quest) => {
            const totalObjectives = quest.objectivesTotal || 0;
            let completedObjectives = quest.objectivesCompleted || 0;

            if (quest.objectives && quest.objectives.length > 0 && totalObjectives > 0) {
              completedObjectives = quest.objectives.filter((objective) => {
                if (typeof objective.requiredCount === "number" && objective.requiredCount > 0) {
                  return (objective.collectedCount ?? 0) >= objective.requiredCount;
                }
                return false;
              }).length;
            } else if (quest.status === "completed") {
              completedObjectives = totalObjectives;
            }

            const pct = percentage(completedObjectives, totalObjectives || 1);

            const isExpanded = expandedQuestId === quest.id;

            return (
              <div
                key={quest.id}
                ref={(el) => {
                  if (el) {
                    questRefs.current[quest.id] = el;
                  }
                }}
              >
                <Card className="border-zinc-900/80 bg-zinc-950/85 px-3 py-2.5">
                <div
                  role="button"
                  tabIndex={0}
                  className="flex w-full items-start justify-between gap-3 pb-2 text-left"
                  onClick={() =>
                    setExpandedQuestId((current) =>
                      current === quest.id ? null : quest.id,
                    )
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setExpandedQuestId((current) =>
                        current === quest.id ? null : quest.id,
                      );
                    }
                  }}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <CardTitle className="truncate text-sm font-semibold text-zinc-100">
                        {quest.title}
                      </CardTitle>
                      {quest.kappaRequired ? (
                        <Badge variant="success" className="px-2 py-0 text-[9px]">
                          Kappa
                        </Badge>
                      ) : null}
                      {quest.lightkeeperRequired ? (
                        <Badge variant="warning" className="px-2 py-0 text-[9px]">
                          LK
                        </Badge>
                      ) : null}
                      {quest.requiredKeys && quest.requiredKeys.length > 0 ? (
                        <Badge variant="warning" className="px-2 py-0 text-[9px]">
                          Key
                        </Badge>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-1 text-[10px] text-zinc-400">
                      <span>{quest.trader}</span>
                      <span>{quest.map}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {quest.status === "locked" || quest.status === "completed" ? (
                      <Badge variant={STATUS_VARIANT[quest.status]} className="self-start">
                        {STATUS_LABEL[quest.status]}
                      </Badge>
                    ) : null}
                    {quest.status === "locked" && quest.lockReasons && quest.lockReasons.length > 0 ? (
                      <p className="max-w-xs text-right text-[10px] text-zinc-500">
                        Locked (
                        {(quest.lockReasons ?? []).map((reason, index, reasons) => {
                          const targetQuest = quests.find((q) => q.title === reason);
                          const isLast = index === reasons.length - 1;
                          const separator = isLast ? "" : ", ";

                          if (!targetQuest) {
                            return (
                              <span key={`${reason}-${index}`}>
                                {reason}
                                {separator}
                              </span>
                            );
                          }

                          return (
                            <button
                              key={`${reason}-${index}`}
                              type="button"
                              className="underline decoration-dotted underline-offset-2 hover:text-emerald-300"
                              onClick={(event) => {
                                event.stopPropagation();
                                const targetStatus: Exclude<QuestStatus, "in_progress"> =
                                  targetQuest.status === "in_progress" ? "available" : targetQuest.status;
                                setStatus(targetStatus);
                                setPendingScrollTargetId(targetQuest.id);
                              }}
                            >
                              {reason}
                              {separator}
                            </button>
                          );
                        })}
                        )
                      </p>
                    ) : null}
                    {quest.status === "locked" && quest.requiredKeys && quest.requiredKeys.length > 0 ? (
                      <p className="max-w-xs text-right text-[10px] text-amber-400">
                        Required keys: {quest.requiredKeys.join(", ")}
                      </p>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant={quest.status === "completed" ? "ghost" : "primary"}
                      className={
                        quest.status === "completed"
                          ? "h-7 px-2 text-[10px] bg-rose-600/85 text-zinc-50 hover:bg-rose-500"
                          : "h-7 px-2 text-[10px]"
                      }
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleToggleCompleted(quest);
                      }}
                      disabled={savingObjectivesFor === quest.id}
                    >
                      {quest.status === "completed" ? "Unmark" : "Mark completed"}
                    </Button>
                  </div>
                </div>

                <CardContent className="space-y-3 pt-0 text-xs text-zinc-300">
                  <div className="space-y-1">
                    <ProgressBar value={pct} />
                    <p className="flex items-center justify-between text-[11px] text-zinc-500">
                      <span>
                        {completedObjectives}/{totalObjectives} objectives
                      </span>
                      <span>{pct}%</span>
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1.5 text-[10px] text-zinc-200">
                    {quest.requiredItemsFir && quest.requiredItemsFir.length > 0 ? (
                      <span className="rounded-full border border-emerald-500/50 bg-emerald-500/10 px-2 py-[1px]">
                        FIR items
                      </span>
                    ) : null}
                    {quest.requiredItemsNonFir &&
                    quest.requiredItemsNonFir.length > 0 ? (
                      <span className="rounded-full border border-zinc-700/80 bg-zinc-900/80 px-2 py-[1px]">
                        Items
                      </span>
                    ) : null}
                    {quest.requiredEquipment && quest.requiredEquipment.length > 0 ? (
                      <span className="rounded-full border border-zinc-700/80 bg-zinc-900/80 px-2 py-[1px]">
                        Equipment
                      </span>
                    ) : null}
                    {quest.requiredKeys && quest.requiredKeys.length > 0 ? (
                      <span className="rounded-full border border-zinc-700/80 bg-zinc-900/80 px-2 py-[1px]">
                        Keys
                      </span>
                    ) : null}
                    {quest.requirementTags?.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-zinc-700/80 bg-zinc-900/80 px-2 py-[1px] capitalize"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {isExpanded ? (
                    <div className="space-y-3 border-t border-zinc-900/80 pt-3 text-[11px] text-zinc-300">
                      {quest.wikiLink || quest.mapWikiLink ? (
                        <div className="flex flex-wrap items-center gap-2">
                          {quest.wikiLink ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-[10px]"
                              onClick={() => window.open(quest.wikiLink as string, "_blank")}
                            >
                              Wiki
                            </Button>
                          ) : null}
                          {quest.mapWikiLink ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-[10px]"
                              disabled
                            >
                              Show on map
                            </Button>
                          ) : null}
                        </div>
                      ) : null}

                      {(quest.previousQuestIds && quest.previousQuestIds.length > 0) ||
                      (quest.nextQuestIds && quest.nextQuestIds.length > 0) ? (
                        <div className="flex flex-wrap gap-3 text-[10px] text-zinc-300">
                          {quest.previousQuestIds && quest.previousQuestIds.length > 0 ? (
                            <div className="space-y-1">
                              <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                                Previous quests
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {quest.previousQuestIds
                                  .map((id) => quests.find((q) => q.id === id))
                                  .filter((q): q is Quest => Boolean(q))
                                  .map((prevQuest) => (
                                    <button
                                      key={prevQuest.id}
                                      type="button"
                                      className="rounded-full border border-zinc-700/80 bg-zinc-950/80 px-2.5 py-[3px] text-[10px] text-zinc-200"
                                      onClick={() => {
                                        const targetStatus: Exclude<QuestStatus, "in_progress"> =
                                          prevQuest.status === "in_progress" ? "available" : prevQuest.status;
                                        setStatus(targetStatus);
                                        setPendingScrollTargetId(prevQuest.id);
                                      }}
                                    >
                                      {prevQuest.title}
                                    </button>
                                  ))}
                              </div>
                            </div>
                          ) : null}

                          {quest.nextQuestIds && quest.nextQuestIds.length > 0 ? (
                            <div className="space-y-1">
                              <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                                Next quests
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {quest.nextQuestIds
                                  .map((id) => quests.find((q) => q.id === id))
                                  .filter((q): q is Quest => Boolean(q))
                                  .map((nextQuest) => (
                                    <button
                                      key={nextQuest.id}
                                      type="button"
                                      className="rounded-full border border-zinc-700/80 bg-zinc-950/80 px-2.5 py-[3px] text-[10px] text-zinc-200"
                                      onClick={() => {
                                        const targetStatus: Exclude<QuestStatus, "in_progress"> =
                                          nextQuest.status === "in_progress" ? "available" : nextQuest.status;
                                        setStatus(targetStatus);
                                        setPendingScrollTargetId(nextQuest.id);
                                      }}
                                    >
                                      {nextQuest.title}
                                    </button>
                                  ))}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      {quest.objectives && quest.objectives.length > 0 ? (
                        <div className="space-y-1.5">
                          {quest.objectives.map((objective: QuestObjectiveSummary) => {
                            const required = objective.requiredCount ?? 0;
                            const collected = objective.collectedCount ?? 0;
                            const done =
                              (required > 0 && collected >= required) ||
                              (required === 0 && quest.status === "completed");

                            return (
                              <div
                                key={objective.id}
                                className="flex items-center gap-2 rounded-md bg-zinc-950/80 px-2 py-1.5"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  if (required <= 0) return;
                                  const nextCollected = done ? 0 : required;
                                  void handleObjectiveCountChange(quest, objective, nextCollected);
                                }}
                              >
                                <div className="flex-1">
                                  <p
                                    className={[
                                      "text-[11px] text-zinc-200",
                                      done ? "line-through text-zinc-500" : "",
                                    ].join(" ")}
                                  >
                                    {objective.description}
                                    {objective.isKeyObjective ? (
                                      <span className="ml-2 rounded-full border border-amber-400/60 bg-amber-500/10 px-1.5 py-px text-[9px] uppercase tracking-[0.14em] text-amber-200">
                                        Key objective
                                      </span>
                                    ) : null}
                                    {objective.requiresFir ? (
                                      <span className="ml-2 rounded-full border border-emerald-500/60 bg-emerald-500/10 px-1.5 py-px text-[9px] uppercase tracking-[0.14em] text-emerald-200">
                                        FIR
                                      </span>
                                    ) : null}
                                  </p>
                                  {required > 0 ? (
                                    <div className="mt-1 flex items-center gap-1.5 text-[10px] text-zinc-500">
                                      <button
                                        type="button"
                                        className="flex h-5 w-5 items-center justify-center rounded-full border border-zinc-700 bg-zinc-950 text-[11px] text-zinc-200"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          void handleObjectiveCountChange(quest, objective, Math.max(0, collected - 1));
                                        }}
                                      >
                                        -
                                      </button>
                                      <div className="relative h-1.5 w-20 rounded-full bg-zinc-800">
                                        <div
                                          className="absolute inset-y-0 left-0 rounded-full bg-emerald-500"
                                          style={{ width: `${required > 0 ? Math.min(100, (collected / required) * 100) : 0}%` }}
                                        />
                                      </div>
                                      <button
                                        type="button"
                                        className="flex h-5 w-5 items-center justify-center rounded-full border border-zinc-700 bg-zinc-950 text-[11px] text-zinc-200"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          void handleObjectiveCountChange(quest, objective, collected + 1);
                                        }}
                                      >
                                        +
                                      </button>
                                      <span>
                                        {collected}/{required}
                                      </span>
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                      {(quest.requiredItemsFir && quest.requiredItemsFir.length > 0) ||
                      (quest.requiredItemsNonFir && quest.requiredItemsNonFir.length > 0) ||
                      (quest.requiredEquipment && quest.requiredEquipment.length > 0) ||
                      (quest.requiredKeys && quest.requiredKeys.length > 0) ? (
                        <div className="space-y-1 text-[10px] text-zinc-300">
                          {quest.requiredItemsFir && quest.requiredItemsFir.length > 0 ? (
                            <p>
                              <span className="font-semibold text-emerald-300">FIR items:</span> {quest.requiredItemsFir.join("; ")}
                            </p>
                          ) : null}
                          {quest.requiredItemsNonFir && quest.requiredItemsNonFir.length > 0 ? (
                            <p>
                              <span className="font-semibold text-zinc-200">Items:</span> {quest.requiredItemsNonFir.join("; ")}
                            </p>
                          ) : null}
                          {quest.requiredEquipment && quest.requiredEquipment.length > 0 ? (
                            <p>
                              <span className="font-semibold text-zinc-200">Equipment / limitations:</span> {quest.requiredEquipment.join("; ")}
                            </p>
                          ) : null}
                          {quest.requiredKeys && quest.requiredKeys.length > 0 ? (
                            <p>
                              <span className="font-semibold text-amber-300">Keys:</span> {quest.requiredKeys.join("; ")}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <p className="text-xs text-zinc-500">
              No quests match the current filters.
            </p>
          )}
        </div>
      </section>
    </AppShell>
  );
}

export default function QuestsPage() {
  return (
    <Suspense fallback={<div>Loading quests...</div>}>
      <QuestsContent />
    </Suspense>
  );
}
