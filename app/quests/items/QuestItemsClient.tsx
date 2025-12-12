"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import type { QuestStatus } from "@/lib/types/quest";
import { percentage } from "@/lib/utils";
import { Boxes, Search, Check, Clock, Lock } from "lucide-react";

interface ObjectiveProgress {
  questId: string;
  objectiveId: string;
  collected: number;
}

interface QuestProgressFromApi {
  questId: string;
  status: string;
}

interface UserProgressResponse {
  quests?: QuestProgressFromApi[];
  objectives?: ObjectiveProgress[];
}

interface QuestForItems {
  id: string;
  title: string;
  kappaRequired: boolean;
  lightkeeperRequired: boolean;
  status: QuestStatus;
  previousQuestIds: string[];
}

interface QuestItemRequirement {
  questId: string;
  questTitle: string;
  questStatus: QuestStatus;
  questLocked: boolean;
  kappaRequiredQuest: boolean;
  lightkeeperRequiredQuest: boolean;

  objectiveId: string;

  itemId: string;
  itemName: string;
  itemShortName?: string;
  itemIconLink?: string;
  itemWikiLink?: string;

  requiresFir: boolean;
  requiredCount: number;
  collectedCount: number;
}

interface AggregatedQuestItem {
  itemId: string;
  name: string;
  shortName?: string;
  iconLink?: string;
  wikiLink?: string;

  requiresFir: boolean;
  totalRequired: number;
  totalCollected: number;

  isKappaItem: boolean;
  isLightkeeperItem: boolean;

  requirements: QuestItemRequirement[];
}

interface QuestItemsClientProps {
  initialTasks?: TaskForItemsRef[];
  initialUserProgress?: UserProgressResponse | null;
}

const TASK_ITEMS_QUERY = `
  query QuestItems {
    tasks {
      id
      name
      kappaRequired
      lightkeeperRequired
      taskRequirements {
        task {
          id
          name
        }
        status
      }
      objectives {
        id
        type
        description
        ... on TaskObjectiveItem {
          items {
            id
            name
            shortName
            iconLink
            wikiLink
          }
          count
          foundInRaid
        }
      }
    }
  }
`;

const QUEST_ITEMS_CACHE_KEY = "tasksRefCache-v1";

interface TaskObjectiveRef {
  id?: string;
  description?: string | null;
  items?: {
    id?: string;
    name?: string;
    shortName?: string;
    iconLink?: string;
    wikiLink?: string;
  }[];
  count?: number | null;
  foundInRaid?: boolean | null;
}

interface TaskForItemsRef {
  id: string;
  name?: string | null;
  kappaRequired?: boolean | null;
  lightkeeperRequired?: boolean | null;
  taskRequirements?: {
    task?: { id?: string | null; name?: string | null } | null;
    status?: string | null;
  }[];
  objectives?: TaskObjectiveRef[];
}

function computeQuestLocking(quests: QuestForItems[]): QuestForItems[] {
  const completedIds = new Set(quests.filter((q) => q.status === "completed").map((q) => q.id));

  return quests.map((quest) => {
    if (quest.status === "completed") return quest;

    const lockReasons: string[] = [];

    if (quest.previousQuestIds && quest.previousQuestIds.length > 0) {
      const missingPrev = quest.previousQuestIds.filter((id) => !completedIds.has(id));
      if (missingPrev.length > 0) {
        lockReasons.push("previous");
      }
    }

    if (lockReasons.length > 0) {
      return { ...quest, status: "locked" };
    }

    return { ...quest, status: "available" };
  });
}

export default function QuestItemsClient({ initialTasks, initialUserProgress }: QuestItemsClientProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [quests, setQuests] = useState<QuestForItems[]>([]);
  const [objectiveProgress, setObjectiveProgress] = useState<ObjectiveProgress[]>([]);
  const [tasksForItems, setTasksForItems] = useState<TaskForItemsRef[]>([]);

  const [query, setQuery] = useState("");
  const [itemsTab, setItemsTab] = useState<"needed" | "found">("needed");
  const [firOnly, setFirOnly] = useState(true);
  const [kappaOnly, setKappaOnly] = useState(true);
  const [lightkeeperOnly, setLightkeeperOnly] = useState(false);
  const [viewMode, setViewMode] = useState<"items-per-quest" | "quests-per-item">("items-per-quest");
  const [completedQuestMessage, setCompletedQuestMessage] = useState<string | null>(null);
  const [teamProgress, setTeamProgress] = useState<
    | {
        teamId: string;
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
  const [canSyncToServer, setCanSyncToServer] = useState(() => Boolean(initialUserProgress));

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        let cachedTasks: TaskForItemsRef[] | null = null;

        if (typeof window !== "undefined") {
          try {
            const rawCache = window.localStorage.getItem(QUEST_ITEMS_CACHE_KEY);
            if (rawCache) {
              const parsed = JSON.parse(rawCache) as { updatedAt?: number; tasks?: TaskForItemsRef[] };
              if (Array.isArray(parsed.tasks)) {
                cachedTasks = parsed.tasks;
              }
            }
          } catch {
            // ignore malformed cache
          }
        }

        let rawTasks: TaskForItemsRef[] | null = cachedTasks;

        if (!rawTasks && initialTasks && Array.isArray(initialTasks) && initialTasks.length > 0) {
          rawTasks = initialTasks;

          if (typeof window !== "undefined") {
            try {
              window.localStorage.setItem(
                QUEST_ITEMS_CACHE_KEY,
                JSON.stringify({ updatedAt: Date.now(), tasks: rawTasks }),
              );
            } catch {
              // ignore localStorage errors
            }
          }
        }

        let tasksRes: Response | null = null;
        let progressJson: UserProgressResponse | null = null;

        if (!rawTasks) {
          tasksRes = await fetch("/api/v1/ref/tasks", {
            method: "GET",
          });

          const tasksJson = (await tasksRes.json().catch(() => null)) as
            | { tasks?: TaskForItemsRef[] }
            | null;

          if (!tasksRes.ok || !tasksJson || !Array.isArray(tasksJson.tasks)) {
            console.error("tarkov.dev tasks error (items)", { status: tasksRes.status, tasksJson });
            setError("Failed to load quest items from tarkov.dev");
            setLoading(false);
            return;
          }

          rawTasks = tasksJson.tasks ?? null;

          if (typeof window !== "undefined") {
            try {
              window.localStorage.setItem(
                QUEST_ITEMS_CACHE_KEY,
                JSON.stringify({ updatedAt: Date.now(), tasks: rawTasks }),
              );
            } catch {
              // ignore localStorage errors
            }
          }
        }

        // Progress is now hydrated on the server and provided via
        // initialUserProgress. If it's missing (e.g. logged out), we
        // simply proceed with no server progress and rely on
        // localStorage merges instead of calling /api/v1/me/progress
        // from the client.
        if (initialUserProgress && typeof initialUserProgress === "object") {
          progressJson = initialUserProgress;
          setCanSyncToServer(true);
        }

        if (!rawTasks) {
          setError("Failed to load quest items from tarkov.dev");
          setLoading(false);
          return;
        }

        const filteredTasks: TaskForItemsRef[] = rawTasks.filter((task) => {
          const title = String(task?.name ?? "");
          const normalized = title.trim().toLowerCase();

          // Exclude Collector quest items from this page
          if (normalized === "the collector" || normalized === "collector") return false;

          return true;
        });

        const userProgress: UserProgressResponse | null =
          progressJson && typeof progressJson === "object" ? (progressJson as UserProgressResponse) : null;

        const statusByQuestId = new Map<string, string>();

        if (userProgress?.quests && Array.isArray(userProgress.quests)) {
          for (const qp of userProgress.quests) {
            if (!qp || !qp.questId) continue;
            statusByQuestId.set(String(qp.questId), String(qp.status));
          }
        }

        // Merge quest completion from quests page stored in
        // localStorage (questsProgress) so quest status is consistent
        // between the Quests and Quest Items pages, even when
        // /api/user/progress is unavailable.
        if (typeof window !== "undefined") {
          try {
            const rawPersisted = window.localStorage.getItem("questsProgress");
            if (rawPersisted) {
              const data = JSON.parse(rawPersisted) as {
                quests?: { questId?: string; status?: string }[];
                objectives?: { questId?: string; objectiveId?: string; collected?: number }[];
              };

              if (Array.isArray(data.quests)) {
                for (const entry of data.quests) {
                  if (!entry || !entry.questId || !entry.status) continue;
                  const id = String(entry.questId);
                  const persistedStatus = String(entry.status);
                  const serverStatus = statusByQuestId.get(id);

                  // Prefer completed over any other status. If server has
                  // no status, fall back to persisted value.
                  if (!serverStatus || persistedStatus === "completed") {
                    statusByQuestId.set(id, persistedStatus);
                  }
                }
              }
            }
          } catch {
            // ignore malformed localStorage
          }
        }

        const mappedQuests: QuestForItems[] = filteredTasks.map((task) => {
          const previousQuestIds: string[] = Array.isArray(task.taskRequirements)
            ? task.taskRequirements
                .map((req) => req?.task?.id)
                .filter((id: unknown): id is string => typeof id === "string")
            : [];

          const title = String(task.name ?? "Unknown task");

          let questStatus: QuestStatus = "available";
          const rawStatus = statusByQuestId.get(String(task.id));
          if (rawStatus === "completed") questStatus = "completed";

          const quest: QuestForItems = {
            id: String(task.id),
            title,
            kappaRequired: Boolean(task.kappaRequired),
            lightkeeperRequired: Boolean(task.lightkeeperRequired),
            status: questStatus,
            previousQuestIds,
          };

          return quest;
        });

        const lockedQuests = computeQuestLocking(mappedQuests);

        if (!cancelled) {
          setTasksForItems(filteredTasks);
          setQuests(lockedQuests);

          // Build objective progress from backend
          const allObjectiveProgress: ObjectiveProgress[] = [];
          if (userProgress?.objectives && Array.isArray(userProgress.objectives)) {
            for (const op of userProgress.objectives) {
              if (!op || !op.questId || !op.objectiveId) continue;
              allObjectiveProgress.push({
                questId: String(op.questId),
                objectiveId: String(op.objectiveId),
                collected: Number(op.collected ?? 0),
              });
            }
          }

          let mergedObjectiveProgress = allObjectiveProgress;

          // Merge objective progress from quests page stored in
          // localStorage (questsProgress) so both pages share the same
          // notion of how many units are collected for each objective.
          if (typeof window !== "undefined") {
            try {
              const rawPersisted = window.localStorage.getItem("questsProgress");
              if (rawPersisted) {
                const data = JSON.parse(rawPersisted) as {
                  objectives?: { questId?: string; objectiveId?: string; collected?: number }[];
                };

                if (Array.isArray(data.objectives)) {
                  const byKey = new Map<string, ObjectiveProgress>();
                  for (const op of mergedObjectiveProgress) {
                    byKey.set(`${op.questId}:${op.objectiveId}`, { ...op });
                  }

                  for (const entry of data.objectives) {
                    if (!entry || !entry.questId || !entry.objectiveId) continue;
                    const key = `${String(entry.questId)}:${String(entry.objectiveId)}`;
                    const persistedCollectedRaw = Number(entry.collected ?? 0);
                    const persistedCollected = Number.isNaN(persistedCollectedRaw)
                      ? 0
                      : persistedCollectedRaw;
                    byKey.set(key, {
                      questId: String(entry.questId),
                      objectiveId: String(entry.objectiveId),
                      collected: persistedCollected,
                    });
                  }

                  mergedObjectiveProgress = Array.from(byKey.values());
                }
              }
            } catch {
              // ignore malformed localStorage
            }
          }

          setObjectiveProgress(mergedObjectiveProgress);
        }
      } catch (err) {
        console.error("Failed to load quest items", err);
        if (!cancelled) {
          setError("Failed to load quest items");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadData();

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
    if (typeof document === "undefined") return;

    try {
      const cookie = document.cookie
        .split("; ")
        .find((entry) => entry.startsWith("questItemsSettings="));
      if (!cookie) return;

      const raw = decodeURIComponent(cookie.split("=")[1] ?? "");
      if (!raw) return;

      const data = JSON.parse(raw) as {
        itemsTab?: "needed" | "found";
        firOnly?: boolean;
        kappaOnly?: boolean;
        lightkeeperOnly?: boolean;
        viewMode?: "items-per-quest" | "quests-per-item";
      };

      if (data.itemsTab === "needed" || data.itemsTab === "found") {
        setItemsTab(data.itemsTab);
      }
      if (typeof data.firOnly === "boolean") setFirOnly(data.firOnly);
      if (typeof data.kappaOnly === "boolean") setKappaOnly(data.kappaOnly);
      if (typeof data.lightkeeperOnly === "boolean") setLightkeeperOnly(data.lightkeeperOnly);
      if (data.viewMode === "items-per-quest" || data.viewMode === "quests-per-item") {
        setViewMode(data.viewMode);
      }
    } catch {
      // ignore malformed cookie
    }
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;

    try {
      const payload = JSON.stringify({ itemsTab, firOnly, kappaOnly, lightkeeperOnly, viewMode });
      const expires = new Date();
      expires.setFullYear(expires.getFullYear() + 1);
      document.cookie = `questItemsSettings=${encodeURIComponent(payload)}; path=/; expires=${expires.toUTCString()}`;
    } catch {
      // ignore cookie errors
    }
  }, [itemsTab, firOnly, kappaOnly, lightkeeperOnly, viewMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem("questsProgress");
      const existing = raw
        ? (JSON.parse(raw) as {
            quests?: { questId?: string; status?: string }[];
            objectives?: { questId?: string; objectiveId?: string; collected?: number }[];
          })
        : {};

      const byKey = new Map<string, { questId: string; objectiveId: string; collected: number }>();

      if (Array.isArray(existing.objectives)) {
        for (const entry of existing.objectives) {
          if (!entry || !entry.questId || !entry.objectiveId) continue;
          const key = `${String(entry.questId)}:${String(entry.objectiveId)}`;
          const collectedRaw = Number(entry.collected ?? 0);
          const collected = Number.isNaN(collectedRaw) ? 0 : collectedRaw;
          byKey.set(key, {
            questId: String(entry.questId),
            objectiveId: String(entry.objectiveId),
            collected,
          });
        }
      }

      for (const op of objectiveProgress) {
        const key = `${op.questId}:${op.objectiveId}`;
        byKey.set(key, {
          questId: op.questId,
          objectiveId: op.objectiveId,
          collected: op.collected,
        });
      }

      const mergedObjectives = Array.from(byKey.values());

      const payload = JSON.stringify({
        quests: Array.isArray(existing.quests) ? existing.quests : existing.quests,
        objectives: mergedObjectives,
      });

      window.localStorage.setItem("questsProgress", payload);
    } catch {
      // ignore localStorage errors
    }
  }, [objectiveProgress]);

  const aggregatedItems = useMemo<AggregatedQuestItem[]>(() => {
    if (tasksForItems.length === 0 || quests.length === 0) return [];

    const questById = new Map<string, QuestForItems>();
    for (const quest of quests) {
      questById.set(quest.id, quest);
    }

    const objectiveProgressByKey = new Map<string, number>();
    for (const op of objectiveProgress) {
      const key = `${op.questId}:${op.objectiveId}`;
      objectiveProgressByKey.set(key, op.collected);
    }

    // Keyed by quest + item so each quest gets its own card per item
    const byKey = new Map<string, AggregatedQuestItem>();

    for (const task of tasksForItems) {
      const quest = questById.get(String(task.id));
      if (!quest) continue;

      if (!Array.isArray(task.objectives)) continue;

      for (const objective of task.objectives ?? []) {
        // We only track concrete item requirements. If an objective lists
        // multiple items, it's usually an "any-of" alternative and would
        // massively over-count (each alt would get the full count). So we
        // only include objectives that reference exactly one item.
        if (!objective || !Array.isArray(objective.items) || objective.items.length !== 1) continue;

        if (!objective.id) continue;
        const objectiveId = String(objective.id);

        const progressKey = `${task.id}:${objectiveId}`;
        let collectedRaw = objectiveProgressByKey.get(progressKey) ?? 0;
        const requiresFir = Boolean(objective.foundInRaid);

        const requiredUnits =
          typeof objective.count === "number" && !Number.isNaN(objective.count) && objective.count > 0
            ? objective.count
            : 1;

        // If the quest itself is completed, treat this objective as fully
        // collected for quest-items purposes, even if objective progress
        // is missing or partial. This links quest completion to item
        // completion so quest items are automatically marked found when
        // the quest is done.
        if (quest.status === "completed") {
          collectedRaw = requiredUnits;
        }

        const collectedUnits = Math.max(0, Math.min(requiredUnits, collectedRaw));

        const description =
          typeof objective.description === "string" ? objective.description.toLowerCase() : "";

        for (const it of objective.items ?? []) {
          if (!it || typeof it !== "object") continue;

          const itemId = String(it.id ?? `${objectiveId}-item`);
          const baseName = String(it.name ?? "Item");
          const shortName = it.shortName ? String(it.shortName) : undefined;
          const iconLink = it.iconLink ? String(it.iconLink) : undefined;
          const wikiLink = it.wikiLink ? String(it.wikiLink) : undefined;

          // Many Tarkov.dev objectives list alternative items in `items`.
          // To avoid massively over-counting (e.g. Salewa 228), only
          // include items that are explicitly named in the description.
          if (description) {
            const baseLower = baseName.toLowerCase();
            const shortLower = shortName ? shortName.toLowerCase() : "";
            if (!description.includes(baseLower) && (!shortLower || !description.includes(shortLower))) {
              continue;
            }
          }

          // Money objectives (roubles / dollars / euros) use a large
          // "count" value to represent currency. For the quest items
          // view we want to treat that as a single turn-in, not N units,
          // otherwise totals explode into the millions. We collapse
          // money objectives so that any amount of currency counts as 1.
          const lowerName = baseName.toLowerCase();
          const lowerShort = shortName ? shortName.toLowerCase() : "";
          const isMoney =
            lowerName.includes("rouble") ||
            lowerName.includes("ruble") ||
            lowerName.includes("rubl") ||
            lowerName.includes("euro") ||
            lowerName.includes("dollar") ||
            lowerShort === "rub" ||
            lowerShort === "eur" ||
            lowerShort === "usd" ||
            lowerShort.includes("₽") ||
            lowerShort.includes("$") ||
            lowerShort.includes("€");

          const itemRequiredUnits = isMoney ? 1 : requiredUnits;
          const itemCollectedUnits = isMoney
            ? collectedRaw >= requiredUnits
              ? 1
              : 0
            : collectedUnits;

          const requirement: QuestItemRequirement = {
            questId: quest.id,
            questTitle: quest.title,
            questStatus: quest.status,
            questLocked: quest.status === "locked",
            kappaRequiredQuest: quest.kappaRequired,
            lightkeeperRequiredQuest: quest.lightkeeperRequired,
            objectiveId,
            itemId,
            itemName: baseName,
            itemShortName: shortName,
            itemIconLink: iconLink,
            itemWikiLink: wikiLink,
            requiresFir,
            requiredCount: itemRequiredUnits,
            collectedCount: itemCollectedUnits,
          };

          const rowKey = `${quest.id}:${itemId}`;
          const existing = byKey.get(rowKey);
          if (!existing) {
            byKey.set(rowKey, {
              itemId,
              name: baseName,
              shortName,
              iconLink,
              wikiLink,
              requiresFir,
              totalRequired: itemRequiredUnits,
              totalCollected: itemCollectedUnits,
              isKappaItem: quest.kappaRequired,
              isLightkeeperItem: quest.lightkeeperRequired,
              requirements: [requirement],
            });
          } else {
            existing.totalRequired += itemRequiredUnits;
            existing.totalCollected += itemCollectedUnits;
            if (requiresFir) existing.requiresFir = true;
            if (quest.kappaRequired) existing.isKappaItem = true;
            if (quest.lightkeeperRequired) existing.isLightkeeperItem = true;
            existing.requirements.push(requirement);
          }
        }
      }
    }

    const depthMemo = new Map<string, number>();

    function getDepth(id: string, visiting: Set<string> = new Set()): number {
      if (depthMemo.has(id)) return depthMemo.get(id)!;
      const quest = questById.get(id);
      if (!quest || !quest.previousQuestIds || quest.previousQuestIds.length === 0) {
        depthMemo.set(id, 0);
        return 0;
      }
      if (visiting.has(id)) {
        depthMemo.set(id, 0);
        return 0;
      }
      visiting.add(id);
      let depth = 0;
      for (const prevId of quest.previousQuestIds) {
        depth = Math.max(depth, getDepth(prevId, visiting) + 1);
      }
      visiting.delete(id);
      depthMemo.set(id, depth);
      return depth;
    }

    const items = Array.from(byKey.values());

    items.sort((a, b) => {
      const aDepth = a.requirements.reduce((min, req) => {
        const d = getDepth(req.questId);
        return Math.min(min, d);
      }, Number.POSITIVE_INFINITY);

      const bDepth = b.requirements.reduce((min, req) => {
        const d = getDepth(req.questId);
        return Math.min(min, d);
      }, Number.POSITIVE_INFINITY);

      const aVal = Number.isFinite(aDepth) ? aDepth : 0;
      const bVal = Number.isFinite(bDepth) ? bDepth : 0;

      if (aVal !== bVal) return aVal - bVal;
      return a.name.localeCompare(b.name);
    });

    return items;
  }, [tasksForItems, quests, objectiveProgress]);

  const aggregatedByItem = useMemo<AggregatedQuestItem[]>(() => {
    if (aggregatedItems.length === 0) return [];

    const byId = new Map<string, AggregatedQuestItem>();

    for (const row of aggregatedItems) {
      const existing = byId.get(row.itemId);
      if (!existing) {
        byId.set(row.itemId, {
          ...row,
          requirements: [...row.requirements],
        });
      } else {
        existing.totalRequired += row.totalRequired;
        existing.totalCollected += row.totalCollected;
        if (row.requiresFir) existing.requiresFir = true;
        if (row.isKappaItem) existing.isKappaItem = true;
        if (row.isLightkeeperItem) existing.isLightkeeperItem = true;
        existing.requirements.push(...row.requirements);
      }
    }

    const items = Array.from(byId.values());
    items.sort((a, b) => a.name.localeCompare(b.name));
    return items;
  }, [aggregatedItems]);

  const filteredItems = useMemo(() => {
    const sourceItems = viewMode === "items-per-quest" ? aggregatedItems : aggregatedByItem;
    const normalizedQuery = query.trim().toLowerCase();

    const byFiltersApplied = sourceItems
      .map((item) => {
        // Apply FIR / Kappa / LK at the requirement level so counts are not inflated
        const scopedRequirements = item.requirements.filter((req) => {
          if (firOnly && !req.requiresFir) return false;
          if (kappaOnly && !req.kappaRequiredQuest) return false;
          if (lightkeeperOnly && !req.lightkeeperRequiredQuest) return false;
          return true;
        });

        if (scopedRequirements.length === 0) return null;

        const totalRequired = scopedRequirements.reduce((sum, req) => sum + req.requiredCount, 0);
        const totalCollected = scopedRequirements.reduce((sum, req) => sum + req.collectedCount, 0);

        return {
          ...item,
          totalRequired,
          totalCollected,
          requirements: scopedRequirements,
        } as AggregatedQuestItem;
      })
      .filter((it): it is AggregatedQuestItem => it !== null);

    return byFiltersApplied.filter((item) => {
      const isFound = item.totalCollected >= item.totalRequired && item.totalRequired > 0;

      if (itemsTab === "needed" && isFound) return false;
      if (itemsTab === "found" && !isFound) return false;

      if (!normalizedQuery) return true;

      const haystack = `${item.name} ${item.shortName ?? ""}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [aggregatedItems, aggregatedByItem, viewMode, itemsTab, firOnly, kappaOnly, lightkeeperOnly, query]);

  const displayItems = useMemo(() => {
    const items = [...filteredItems];

    if (viewMode === "items-per-quest") {
      const questIndex = new Map<string, number>();
      quests.forEach((quest, index) => {
        questIndex.set(quest.id, index);
      });

      const statusRank: Record<QuestStatus, number> = {
        available: 0,
        in_progress: 0,
        completed: 1,
        locked: 2,
      };

      items.sort((a, b) => {
        const aQuestId = a.requirements[0]?.questId ?? "";
        const bQuestId = b.requirements[0]?.questId ?? "";
        const aQuest = quests.find((q) => q.id === aQuestId);
        const bQuest = quests.find((q) => q.id === bQuestId);

        const aStatus = aQuest?.status ?? "available";
        const bStatus = bQuest?.status ?? "available";

        const aRank = statusRank[aStatus] ?? 1;
        const bRank = statusRank[bStatus] ?? 1;

        if (aRank !== bRank) return aRank - bRank;

        const aIdx = questIndex.get(aQuestId) ?? 0;
        const bIdx = questIndex.get(bQuestId) ?? 0;
        if (aIdx !== bIdx) return aIdx - bIdx;

        return a.name.localeCompare(b.name);
      });
    } else {
      items.sort((a, b) => a.name.localeCompare(b.name));
    }

    return items;
  }, [filteredItems, viewMode, quests]);

  const firSummary = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const items: AggregatedQuestItem[] = [];

    for (const item of aggregatedByItem) {
      const baseReqs = firOnly
        ? item.requirements.filter((req) => req.requiresFir)
        : item.requirements;
      if (baseReqs.length === 0) continue;

      const scopedReqs = baseReqs.filter((req) => {
        if (kappaOnly && !req.kappaRequiredQuest) return false;
        if (lightkeeperOnly && !req.lightkeeperRequiredQuest) return false;
        return true;
      });

      if (scopedReqs.length === 0) continue;

      const totalRequired = scopedReqs.reduce((sum, req) => sum + req.requiredCount, 0);
      const totalCollected = scopedReqs.reduce((sum, req) => sum + req.collectedCount, 0);

      const haystack = `${item.name} ${item.shortName ?? ""}`.toLowerCase();
      if (normalizedQuery && !haystack.includes(normalizedQuery)) continue;

      items.push({
        ...item,
        requiresFir: firOnly ? true : item.requiresFir,
        totalRequired,
        totalCollected,
        requirements: scopedReqs,
      });
    }

    const totalRequired = items.reduce((sum, it) => sum + it.totalRequired, 0);
    const totalCollected = items.reduce((sum, it) => sum + it.totalCollected, 0);

    return {
      items,
      totalRequired,
      totalCollected,
      totalRemaining: Math.max(totalRequired - totalCollected, 0),
    };
  }, [aggregatedByItem, firOnly, kappaOnly, lightkeeperOnly, query]);

  const overallStats = useMemo(() => {
    const totalItems = firSummary.items.length;
    const totalRequiredUnits = firSummary.totalRequired;
    const totalRemainingUnits = Math.max(firSummary.totalRequired - firSummary.totalCollected, 0);

    return {
      totalItems,
      totalRequiredUnits,
      totalCollectedUnits: firSummary.totalCollected,
      totalRemainingUnits,
    };
  }, [firSummary]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const rawExisting = window.localStorage.getItem("dashboardItemsIndex");
      const existing: { id: string; name: string }[] = rawExisting ? JSON.parse(rawExisting) : [];
      const byId = new Map<string, { id: string; name: string }>();
      for (const entry of existing) {
        if (!entry || !entry.id) continue;
        byId.set(String(entry.id), { id: String(entry.id), name: String(entry.name ?? "Item") });
      }

      for (const item of aggregatedByItem) {
        if (!item || !item.itemId) continue;
        const id = String(item.itemId);
        const name = String(item.name ?? "Item");
        byId.set(id, { id, name });
      }

      const payload = JSON.stringify(Array.from(byId.values()));
      window.localStorage.setItem("dashboardItemsIndex", payload);
    } catch {
      // ignore localStorage errors
    }
  }, [aggregatedByItem, firSummary]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const payload = JSON.stringify(overallStats);
      window.localStorage.setItem("questItemsSummary", payload);
    } catch {
      // ignore localStorage errors
    }
  }, [overallStats]);

  async function handleToggleItem(item: AggregatedQuestItem, markFound: boolean) {
    if (item.requirements.length === 0) return;

    const completedReqs = item.requirements.filter((req) => req.questStatus === "completed");
    if (completedReqs.length > 0 && !markFound) {
      const questNames = Array.from(new Set(completedReqs.map((req) => req.questTitle))).filter(Boolean).join(", ");
      setCompletedQuestMessage(
        questNames
          ? `Quest completed: ${questNames}. Adjust its progress on the Quests page.`
          : "This quest is already completed. Adjust its progress on the Quests page.",
      );
      return;
    }

    const objectivesPayload = item.requirements.map((req) => ({
      questId: req.questId,
      objectiveId: req.objectiveId,
      collected: markFound ? req.requiredCount : 0,
    }));

    setObjectiveProgress((prev) => {
      const byKey = new Map<string, ObjectiveProgress>();
      for (const entry of prev) {
        byKey.set(`${entry.questId}:${entry.objectiveId}`, { ...entry });
      }
      for (const incoming of objectivesPayload) {
        byKey.set(`${incoming.questId}:${incoming.objectiveId}`, {
          questId: incoming.questId,
          objectiveId: incoming.objectiveId,
          collected: incoming.collected,
        });
      }
      return Array.from(byKey.values());
    });

    try {
      if (canSyncToServer) {
        try {
          await fetch("/api/user/progress", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ objectives: objectivesPayload }),
          });
        } catch (err) {
          console.error("Failed to update quest item progress", err);
        }
      }
    } catch {
      // ignore network issues for anonymous or flaky sessions
    }
  }

  async function handleAdjustItemCount(item: AggregatedQuestItem, delta: number) {
    if (!delta || item.requirements.length === 0) return;

    if (delta < 0) {
      const completedReqs = item.requirements.filter((req) => req.questStatus === "completed");
      if (completedReqs.length > 0) {
        const questNames = Array.from(new Set(completedReqs.map((req) => req.questTitle))).filter(Boolean).join(", ");
        setCompletedQuestMessage(
          questNames
            ? `Quest completed: ${questNames}. Adjust its progress on the Quests page.`
            : "This quest is already completed. Adjust its progress on the Quests page.",
        );
        return;
      }
    }

    // Clamp delta so we never go below 0 or above totalRequired
    const currentTotal = item.totalCollected;
    const maxTotal = item.totalRequired;
    if (maxTotal <= 0) return;

    const minDelta = -currentTotal;
    const maxDelta = maxTotal - currentTotal;
    if (maxDelta === 0 && delta > 0) return;
    if (minDelta === 0 && delta < 0) return;

    const effectiveDelta = Math.max(minDelta, Math.min(maxDelta, delta));
    if (!effectiveDelta) return;

    // Work on a mutable copy of requirements so we can distribute changes
    const updatedReqs = item.requirements.map((req) => ({ ...req }));

    const applyStep = (step: number) => {
      if (step > 0) {
        // Increment: fill earliest requirements first
        for (const req of updatedReqs) {
          if (req.collectedCount < req.requiredCount) {
            req.collectedCount += 1;
            return;
          }
        }
      } else if (step < 0) {
        // Decrement: remove from latest requirements first
        for (let i = updatedReqs.length - 1; i >= 0; i -= 1) {
          const req = updatedReqs[i];
          if (req.collectedCount > 0) {
            req.collectedCount -= 1;
            return;
          }
        }
      }
    };

    const steps = Math.abs(effectiveDelta);
    const sign = effectiveDelta > 0 ? 1 : -1;
    for (let i = 0; i < steps; i += 1) {
      applyStep(sign);
    }

    // Build payload of updated objectives
    const objectivesPayloadMap = new Map<string, { questId: string; objectiveId: string; collected: number }>();
    for (const req of updatedReqs) {
      const key = `${req.questId}:${req.objectiveId}`;
      objectivesPayloadMap.set(key, {
        questId: req.questId,
        objectiveId: req.objectiveId,
        collected: req.collectedCount,
      });
    }
    const objectivesPayload = Array.from(objectivesPayloadMap.values());

    setObjectiveProgress((prev) => {
      const byKey = new Map<string, ObjectiveProgress>();
      for (const entry of prev) {
        byKey.set(`${entry.questId}:${entry.objectiveId}`, { ...entry });
      }
      for (const payload of objectivesPayload) {
        byKey.set(`${payload.questId}:${payload.objectiveId}`, {
          questId: payload.questId,
          objectiveId: payload.objectiveId,
          collected: payload.collected,
        });
      }
      return Array.from(byKey.values());
    });

    try {
      if (canSyncToServer) {
        try {
          await fetch("/api/user/progress", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ objectives: objectivesPayload }),
          });
        } catch (err) {
          console.error("Failed to update quest item progress", err);
        }
      }
    } catch {
      // ignore network issues for anonymous or flaky sessions
    }
  }

  return (
    <AppShell
      title="Quest items"
      subtitle="Track quest item requirements across all tasks with the same tools as Kappa items."
    >
      <section className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 rounded-lg border border-zinc-800/80 bg-zinc-950/80 px-3 py-1.5 text-sm text-zinc-100 focus-within:border-emerald-500/60 focus-within:ring-1 focus-within:ring-emerald-500/40">
              <Search className="h-3.5 w-3.5 text-zinc-500" />
              <input
                placeholder="Search quest items"
                className="h-7 w-full bg-transparent text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
                value={query}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="inline-flex rounded-full bg-zinc-900/80 p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setItemsTab("needed")}
                className={`rounded-full px-3 py-1 ${
                  itemsTab === "needed" ? "bg-emerald-600 text-emerald-50" : "text-zinc-300"
                }`}
              >
                Needed
              </button>
              <button
                type="button"
                onClick={() => setItemsTab("found")}
                className={`rounded-full px-3 py-1 ${
                  itemsTab === "found" ? "bg-emerald-600 text-emerald-50" : "text-zinc-300"
                }`}
              >
                Found
              </button>
            </div>

            <button
              type="button"
              onClick={() => setFirOnly((prev) => !prev)}
              className={`rounded-full px-3 py-1 text-[11px] transition-colors ${
                firOnly
                  ? "bg-emerald-600 text-emerald-50"
                  : "border border-zinc-800/80 bg-zinc-950/80 text-zinc-300 hover:border-emerald-500/60"
              }`}
            >
              FIR only
            </button>

            <button
              type="button"
              onClick={() => setKappaOnly((prev) => !prev)}
              className={`rounded-full px-3 py-1 text-[11px] transition-colors ${
                kappaOnly
                  ? "bg-emerald-600 text-emerald-50"
                  : "border border-zinc-800/80 bg-zinc-950/80 text-zinc-300 hover:border-emerald-500/60"
              }`}
            >
              Kappa only
            </button>

            <button
              type="button"
              onClick={() => setLightkeeperOnly((prev) => !prev)}
              className={`rounded-full px-3 py-1 text-[11px] transition-colors ${
                lightkeeperOnly
                  ? "bg-emerald-600 text-emerald-50"
                  : "border border-zinc-800/80 bg-zinc-950/80 text-zinc-300 hover:border-emerald-500/60"
              }`}
            >
              LK only
            </button>

            <div className="inline-flex rounded-full bg-zinc-900/80 p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setViewMode("items-per-quest")}
                className={`rounded-full px-3 py-1 ${
                  viewMode === "items-per-quest" ? "bg-emerald-600 text-emerald-50" : "text-zinc-300"
                }`}
              >
                Items per quest
              </button>
              <button
                type="button"
                onClick={() => setViewMode("quests-per-item")}
                className={`rounded-full px-3 py-1 ${
                  viewMode === "quests-per-item" ? "bg-emerald-600 text-emerald-50" : "text-zinc-300"
                }`}
              >
                Quests per item
              </button>
            </div>
          </div>
        </div>

        <Card className="border border-zinc-800/80 bg-zinc-950/80">
          <CardHeader className="flex items-center gap-2 pb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-300">
              <Boxes className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
                Quest items overview
              </CardTitle>
              <CardDescription className="text-[11px] text-emerald-100/80">
                {overallStats.totalItems} items · {overallStats.totalRemainingUnits}/
                {overallStats.totalRequiredUnits} units remaining
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <ProgressBar
              value={percentage(firSummary.totalCollected, firSummary.totalRequired || 1)}
              showLabel
            />
            <p className="text-[11px] text-emerald-100/80">
              {overallStats.totalCollectedUnits}/{overallStats.totalRequiredUnits} units secured
            </p>
          </CardContent>
        </Card>

        {error ? <p className="text-xs text-red-400">{error}</p> : null}
        {teamProgressError ? (
          <p className="text-[11px] text-rose-400">{teamProgressError}</p>
        ) : null}

        {loading && aggregatedItems.length === 0 ? (
          <p className="text-xs text-zinc-400">Loading quest items…</p>
        ) : null}

        {!loading && filteredItems.length === 0 ? (
          <p className="text-xs text-zinc-400">No quest items match your filters yet.</p>
        ) : null}

        {completedQuestMessage ? (
          <p className="text-xs text-emerald-300">{completedQuestMessage}</p>
        ) : null}

        {displayItems.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {displayItems.map((item) => {
              const isFound = item.totalCollected >= item.totalRequired && item.totalRequired > 0;

              const primaryQuest = item.requirements[0];
              const distinctQuestCount = new Set(item.requirements.map((req) => req.questId)).size;

              const cardKey = `${item.itemId}-${
                viewMode === "items-per-quest" && primaryQuest ? primaryQuest.questId : "all"
              }`;

              return (
                <Card key={cardKey} interactive className="h-full">
                  <CardHeader className="flex flex-col gap-1 pb-2">
                    <div className="flex items-center gap-2">
                      {item.iconLink ? (
                        <img
                          src={item.iconLink}
                          alt={item.name}
                          loading="lazy"
                          className="h-20 w-20 flex-shrink-0 rounded border border-zinc-800 bg-zinc-900 object-contain"
                        />
                      ) : null}
                      <div className="min-w-0">
                        <CardTitle className="truncate text-base font-semibold text-zinc-100">
                          {item.shortName || item.name}
                        </CardTitle>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[9px] text-zinc-500">
                          {item.requiresFir ? (
                            <Badge
                              variant="muted"
                              className="border-emerald-500/60 bg-emerald-500/10 text-[9px] text-emerald-300"
                            >
                              FIR
                            </Badge>
                          ) : null}
                          {item.isKappaItem ? (
                            <Badge variant="success" className="text-[9px]">
                              Kappa
                            </Badge>
                          ) : null}
                          {item.isLightkeeperItem ? (
                            <Badge variant="outline" className="text-[9px]">
                              LK
                            </Badge>
                          ) : null}
                        </div>
                        {viewMode === "items-per-quest" && primaryQuest ? (
                          <p className="mt-0.5 truncate text-[10px] text-zinc-500">
                            {primaryQuest.questStatus === "completed"
                              ? "Completed quest: "
                              : primaryQuest.questStatus === "locked"
                                ? "Locked quest: "
                                : "Available quest: "}
                            <Link
                              href={`/quests?questId=${primaryQuest.questId}`}
                              className="text-emerald-400 hover:underline"
                            >
                              {primaryQuest.questTitle}
                            </Link>
                          </p>
                        ) : null}
                        {viewMode === "items-per-quest" &&
                        primaryQuest &&
                        teamProgress &&
                        teamProgress.members.length > 0 ? (
                          <div className="mt-0.5 flex flex-wrap gap-1 text-[9px] text-zinc-500">
                            <span className="text-zinc-500">Team:</span>
                            {teamProgress.members.map((member) => {
                              const questStatusEntry = member.quests.find(
                                (q) => q.questId === primaryQuest.questId,
                              );
                              if (!questStatusEntry) return null;

                              const status = questStatusEntry.status;

                              let icon: JSX.Element;
                              if (status === "completed") {
                                icon = <Check className="h-3 w-3 text-emerald-400" />;
                              } else if (status === "locked") {
                                icon = <Lock className="h-3 w-3 text-zinc-500" />;
                              } else {
                                icon = <Clock className="h-3 w-3 text-amber-300" />;
                              }

                              return (
                                <span
                                  key={member.userId}
                                  className="inline-flex items-center gap-1 rounded-full bg-zinc-900/80 px-1.5 py-[1px]"
                                >
                                  <span className="max-w-[4.5rem] truncate">
                                    {member.username || "Anon"}
                                  </span>
                                  {icon}
                                </span>
                              );
                            })}
                            {teamProgressLoading ? (
                              <span className="ml-1 text-[9px] text-zinc-500">(loading…)</span>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 pt-0">
                    <div className="flex items-center justify-between text-[11px] text-zinc-400">
                      <span>Progress</span>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-6 px-1 text-[10px]"
                          onClick={() => handleAdjustItemCount(item, -1)}
                        >
                          -
                        </Button>
                        <span>
                          {item.totalCollected}/{item.totalRequired || 0}
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-6 px-1 text-[10px]"
                          onClick={() => handleAdjustItemCount(item, 1)}
                        >
                          +
                        </Button>
                      </div>
                    </div>
                    <ProgressBar value={percentage(item.totalCollected, item.totalRequired || 1)} />
                    <div className="flex items-center justify-between text-[10px] text-zinc-500">
                      {viewMode === "items-per-quest" && primaryQuest ? (
                        <span className="truncate">
                          {primaryQuest.questStatus === "completed"
                            ? "Completed quest: "
                            : primaryQuest.questStatus === "locked"
                              ? "Locked quest: "
                              : "Available quest: "}
                          <Link
                            href={`/quests?questId=${primaryQuest.questId}`}
                            className="text-emerald-400 hover:underline"
                          >
                            {primaryQuest.questTitle}
                          </Link>
                        </span>
                      ) : (
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span>
                            Used in {distinctQuestCount} quest
                            {distinctQuestCount === 1 ? "" : "s"}
                          </span>
                          <div className="flex flex-wrap gap-x-1 gap-y-0.5 text-emerald-400">
                            {Array.from(
                              new Map(item.requirements.map((req) => [req.questId, req.questTitle])).entries(),
                            ).map(([questId, questTitle]) => (
                              <Link
                                key={questId}
                                href={`/quests?questId=${questId}`}
                                className="hover:underline"
                              >
                                {questTitle}
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                      <Button
                        size="sm"
                        variant={isFound ? "outline" : "primary"}
                        onClick={() => handleToggleItem(item, !isFound)}
                        className="h-7 px-2 text-[10px]"
                      >
                        {isFound ? "Back to needed" : "Mark found"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </AppShell>
  );
}
