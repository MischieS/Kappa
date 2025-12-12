"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { TRADERS } from "@/lib/sample-data";
import { percentage } from "@/lib/utils";
import { Boxes, Check, Clock, Lock, Search, Wrench } from "lucide-react";

interface RequirementAttributeRaw {
  type?: string | null;
  name?: string | null;
  value?: number | null;
}

interface HideoutItemRequirementRaw {
  item: {
    id: string;
    name: string;
    shortName?: string;
    iconLink?: string;
    wikiLink?: string;
  } | null;
  count: number | null;
  quantity?: number | null;
  attributes?: RequirementAttributeRaw[] | null;
}

interface RequirementHideoutStationLevelRaw {
  id: string;
  station?: { id?: string; name?: string } | null;
  level?: number | null;
}

interface RequirementSkillRaw {
  id: string;
  name?: string | null;
  level?: number | null;
}

interface RequirementTraderRaw {
  id: string;
  trader?: { name?: string | null } | null;
  requirementType?: string | null;
  compareMethod?: string | null;
  value?: number | null;
}

interface HideoutStationLevelRaw {
  id: string;
  level: number | null;
  itemRequirements?: HideoutItemRequirementRaw[] | null;
  stationLevelRequirements?: RequirementHideoutStationLevelRaw[] | null;
  skillRequirements?: RequirementSkillRaw[] | null;
  traderRequirements?: RequirementTraderRaw[] | null;
}

interface HideoutStationRaw {
  id: string;
  name: string;
  normalizedName?: string | null;
  levels?: HideoutStationLevelRaw[] | null;
}

interface RequirementPerStationLevel {
  stationId: string;
  stationName: string;
  stationLevel: number;
  levelId: string;
  itemId: string;
  requiredCount: number;
  requiresFir: boolean;
}

interface AggregatedHideoutItem {
  itemId: string;
  name: string;
  shortName?: string;
  iconLink?: string;
  wikiLink?: string;

  totalRequired: number;
  totalCollected: number;

  requirements: RequirementPerStationLevel[];
}

interface StationItemProgressEntry {
  stationId: string;
  levelId: string;
  itemId: string;
  collected: number;
}

interface StationProgressEntry {
  stationId: string;
  currentLevel: number;
}

interface TeamNeedMember {
  userId: string;
  username: string | null;
  role: string | null;
  required: number;
  collected: number;
}

interface TeamNeedItem {
  itemId: string;
  name: string;
  shortName?: string;
  iconLink?: string;
  wikiLink?: string;
  requiresFir: boolean;
  totalRequired: number;
  totalCollected: number;
  members: TeamNeedMember[];
}

interface TeamNeedsResponse {
  teamId: string;
  items: TeamNeedItem[];
}

interface HideoutItemsClientProps {
  initialStations?: HideoutStationRaw[];
  initialTraderStandings?: { traderId: string; level: number }[] | null;
}

function isCurrencyItem(name?: string | null, shortName?: string | null): boolean {
  const n = (name ?? "").toLowerCase();
  const s = (shortName ?? "").toLowerCase();

  if (!n && !s) return false;

  if (s === "₽" || s === "$" || s === "€") return true;

  return (
    n.includes("rouble") ||
    n.includes("ruble") ||
    n.includes("euro") ||
    n.includes("dollar")
  );
}

function hasFirAttribute(attributes?: RequirementAttributeRaw[] | null): boolean {
  if (!Array.isArray(attributes)) return false;

  return attributes.some((attr) => {
    const raw = (attr?.name || "").toString().toLowerCase();
    if (!raw) return false;

    const normalized = raw.replace(/[\s_-]+/g, "");

    return (
      normalized === "fir" ||
      normalized.includes("findinraid") ||
      normalized.includes("foundinraid")
    );
  });
}

function normalizeItemKey(name?: string | null): string {
  return (name ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

const HIDEOUT_ITEMS_QUERY = `
  query HideoutItems {
    hideoutStations {
      id
      name
      normalizedName
      levels {
        id
        level
        itemRequirements {
          count
          attributes {
            type
            name
            value
          }
          item {
            id
            name
            shortName
            iconLink
            wikiLink
          }
        }
        stationLevelRequirements {
          id
          level
          station {
            id
            name
          }
        }
        skillRequirements {
          id
          name
          level
        }
        traderRequirements {
          id
          requirementType
          compareMethod
          value
          trader {
            name
          }
        }
      }
    }
  }
`;

const HIDEOUT_ITEMS_CACHE_KEY = "hideoutItemsStationsCache-v2";
const HIDEOUT_ITEMS_PROGRESS_KEY = "hideoutItemsProgress";
const HIDEOUT_STATIONS_PROGRESS_KEY = "hideoutStationsProgress";

export default function HideoutItemsClient({
  initialStations,
  initialTraderStandings,
}: HideoutItemsClientProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [stations, setStations] = useState<HideoutStationRaw[]>([]);
  const [itemProgress, setItemProgress] = useState<StationItemProgressEntry[]>([]);
  const [traderLevelsByName, setTraderLevelsByName] = useState<Record<string, number> | null>(null);

  const [query, setQuery] = useState("");
  const [view, setView] = useState<"stations" | "items">("stations");
  const [itemsTab, setItemsTab] = useState<"needed" | "found">("needed");
  const [firOnly, setFirOnly] = useState(false);
  const [stationProgress, setStationProgress] = useState<StationProgressEntry[]>([]);
  const [stationStatusFilter, setStationStatusFilter] = useState<"active" | "locked" | "maxed">("active");
  const [wikiFirItemKeys, setWikiFirItemKeys] = useState<string[]>([]);
  const [teamNeeds, setTeamNeeds] = useState<TeamNeedsResponse | null>(null);
  const [teamNeedsLoading, setTeamNeedsLoading] = useState(false);
  const [teamNeedsError, setTeamNeedsError] = useState<string | null>(null);

  useEffect(() => {
    let levels: Record<string, number> | null = null;

    function applyStanding(traderId: string, level: number | null | undefined) {
      const trader = TRADERS.find((t) => t.id === traderId);
      if (!trader) return;
      const rawLevel = Number(level ?? trader.level);
      if (Number.isNaN(rawLevel)) return;
      const clamped = Math.min(trader.maxLevel, Math.max(1, rawLevel));
      if (!levels) levels = {};
      levels[trader.name] = clamped;
    }

    if (Array.isArray(initialTraderStandings)) {
      for (const standing of initialTraderStandings) {
        if (!standing || !standing.traderId) continue;
        applyStanding(String(standing.traderId), standing.level);
      }
    }

    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem("traderStandings");
        if (raw) {
          const parsed = JSON.parse(raw) as { traderId?: string; level?: number }[];
          if (Array.isArray(parsed)) {
            for (const entry of parsed) {
              if (!entry || !entry.traderId) continue;
              applyStanding(String(entry.traderId), entry.level);
            }
          }
        }
      } catch {
        // ignore localStorage errors for trader standings
      }
    }

    if (levels && Object.keys(levels).length > 0) {
      setTraderLevelsByName(levels);
    }
  }, [initialTraderStandings]);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        let cachedStations: HideoutStationRaw[] | null = null;
        let wikiFirKeys: string[] = [];
        let wikiStashEditionLevels: Record<string, number> | null = null;
        let wikiCultistCircleEditions: string[] = [];

        if (typeof window !== "undefined") {
          try {
            const rawCache = window.localStorage.getItem(HIDEOUT_ITEMS_CACHE_KEY);
            if (rawCache) {
              const parsed = JSON.parse(rawCache) as { stations?: HideoutStationRaw[] };
              if (Array.isArray(parsed.stations)) {
                cachedStations = parsed.stations;
              }
            }
          } catch {
            // ignore malformed cache
          }
        }

        let stationsData: HideoutStationRaw[] | null = cachedStations;

        // Prefer stations provided by the server page when there is no
        // client-side cache yet, then fall back to the API.
        if ((!stationsData || stationsData.length === 0) && initialStations && initialStations.length > 0) {
          stationsData = initialStations;

          if (typeof window !== "undefined") {
            try {
              window.localStorage.setItem(
                HIDEOUT_ITEMS_CACHE_KEY,
                JSON.stringify({ stations: stationsData }),
              );
            } catch {
              // ignore localStorage errors
            }
          }
        }

        // If there is no cache (local or from the server), refetch from
        // the API so we can populate real data.
        if (!stationsData || stationsData.length === 0) {
          const response = await fetch("/api/v1/ref/hideout-stations", {
            method: "GET",
          });

          const result = (await response.json().catch(() => null)) as
            | { stations?: HideoutStationRaw[] }
            | null;

          if (!response.ok || !result || !Array.isArray(result.stations)) {
            setError("Failed to load hideout data");
            setLoading(false);
            return;
          }

          stationsData = result.stations ?? null;

          if (typeof window !== "undefined") {
            try {
              window.localStorage.setItem(
                HIDEOUT_ITEMS_CACHE_KEY,
                JSON.stringify({ stations: stationsData }),
              );
            } catch {
              // ignore localStorage errors
            }
          }
        }

        // Load wiki-based FIR and edition data (best-effort; UI should still work without it)
        try {
          const wikiRes = await fetch("/api/wiki/hideout-fir");
          if (wikiRes.ok) {
            const wikiJson = (await wikiRes.json()) as {
              firItems?: { name?: string; key?: string }[];
              stashEditionLevels?: Record<string, number>;
              cultistCircleUnlockedEditions?: string[];
            };

            if (Array.isArray(wikiJson.firItems)) {
              wikiFirKeys = wikiJson.firItems
                .map((item) => (
                  item.key ? item.key.toLowerCase() : normalizeItemKey(item.name ?? "")
                ))
                .filter(Boolean);
            }

            if (wikiJson.stashEditionLevels && typeof wikiJson.stashEditionLevels === "object") {
              wikiStashEditionLevels = wikiJson.stashEditionLevels;
            }

            if (
              Array.isArray(wikiJson.cultistCircleUnlockedEditions) &&
              wikiJson.cultistCircleUnlockedEditions.length > 0
            ) {
              wikiCultistCircleEditions = wikiJson.cultistCircleUnlockedEditions;
            }
          }
        } catch {
          // ignore wiki errors
        }

        if (!cancelled) {
          setStations(stationsData ?? []);
          if (wikiFirKeys.length > 0) {
            setWikiFirItemKeys(wikiFirKeys);
          }

          if (typeof window !== "undefined") {
            try {
              const raw = window.localStorage.getItem(HIDEOUT_ITEMS_PROGRESS_KEY);
              if (raw) {
                const parsed = JSON.parse(raw) as {
                  items?: { itemId: string; collected: number }[];
                  stationItems?: StationItemProgressEntry[];
                };

                if (Array.isArray(parsed.stationItems)) {
                  setItemProgress(
                    parsed.stationItems.map((entry) => ({
                      stationId: String(entry.stationId),
                      levelId: String(entry.levelId),
                      itemId: String(entry.itemId),
                      collected: Number(entry.collected ?? 0) || 0,
                    })),
                  );
                } else if (Array.isArray(parsed.items)) {
                  // Backwards compatibility: map old global item progress to a synthetic station/level
                  setItemProgress(
                    parsed.items.map((entry) => ({
                      stationId: "__global__",
                      levelId: "__global__",
                      itemId: String(entry.itemId),
                      collected: Number(entry.collected ?? 0) || 0,
                    })),
                  );
                }
              }
            } catch {
              // ignore malformed progress
            }

            try {
              const rawStations = window.localStorage.getItem(HIDEOUT_STATIONS_PROGRESS_KEY);
              if (rawStations) {
                const parsedStations = JSON.parse(rawStations) as { stations?: StationProgressEntry[] };
                if (Array.isArray(parsedStations.stations)) {
                  setStationProgress(
                    parsedStations.stations.map((entry) => ({
                      stationId: String(entry.stationId),
                      currentLevel: Number(entry.currentLevel ?? 0) || 0,
                    })),
                  );
                }
              } else {
                // No saved station progress yet: seed stash (and potentially Cultist Circle)
                // levels based on player edition using wiki data when available.
                try {
                  const rawSettings = window.localStorage.getItem("kappaPlayerSettings");
                  if (rawSettings && Array.isArray(stationsData)) {
                    const settings = JSON.parse(rawSettings) as { edition?: string };
                    const edition = (settings.edition || "").toString();

                    const seedEntries: StationProgressEntry[] = [];

                    if (edition) {
                      let stashLevel = 0;
                      if (wikiStashEditionLevels && wikiStashEditionLevels[edition] != null) {
                        stashLevel = wikiStashEditionLevels[edition];
                      }

                      if (stashLevel > 0) {
                        const stashStation = stationsData.find((s) => {
                          const n = (s.normalizedName || s.name || "").toString().toLowerCase();
                          return n === "stash";
                        });

                        if (stashStation) {
                          seedEntries.push({
                            stationId: String(stashStation.id),
                            currentLevel: stashLevel,
                          });
                        }
                      }

                      if (
                        wikiCultistCircleEditions.includes(edition) ||
                        (edition === "Unheard" && wikiCultistCircleEditions.length === 0)
                      ) {
                        const cultistStation = stationsData.find((s) => {
                          const n = (s.normalizedName || s.name || "").toString().toLowerCase();
                          return n === "cultist circle";
                        });

                        if (cultistStation) {
                          seedEntries.push({
                            stationId: String(cultistStation.id),
                            currentLevel: 1,
                          });
                        }
                      }
                    }

                    if (seedEntries.length > 0) {
                      setStationProgress(seedEntries);
                    }
                  }
                } catch {
                  // ignore seeding errors
                }
              }
            } catch {
              // ignore malformed station progress
            }
          }
        }
      } catch (err) {
        console.error("Failed to load hideout items", err);
        if (!cancelled) {
          setError("Failed to load hideout items");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  const wikiFirKeySet = useMemo(() => new Set(wikiFirItemKeys.map((k) => k.toLowerCase())), [wikiFirItemKeys]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (itemProgress.length === 0) return;

    try {
      const payload = JSON.stringify({ stationItems: itemProgress });
      window.localStorage.setItem(HIDEOUT_ITEMS_PROGRESS_KEY, payload);
    } catch {
      // ignore localStorage errors
    }
  }, [itemProgress]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (stationProgress.length === 0) return;

    try {
      const payload = JSON.stringify({ stations: stationProgress });
      window.localStorage.setItem(HIDEOUT_STATIONS_PROGRESS_KEY, payload);
    } catch {
      // ignore localStorage errors
    }
  }, [stationProgress]);

  const perStationItemProgress = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of itemProgress) {
      if (!entry || !entry.stationId || !entry.levelId || !entry.itemId) continue;
      const key = `${entry.stationId}|${entry.levelId}|${entry.itemId}`;
      const existing = map.get(key) ?? 0;
      const value = Number(entry.collected ?? 0) || 0;
      map.set(key, Math.max(existing, value));
    }
    return map;
  }, [itemProgress]);

  const aggregatedItemProgressById = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of itemProgress) {
      if (!entry || !entry.itemId) continue;
      const existing = map.get(entry.itemId) ?? 0;
      const value = Number(entry.collected ?? 0) || 0;
      map.set(entry.itemId, existing + value);
    }
    return map;
  }, [itemProgress]);

  const stationProgressById = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of stationProgress) {
      if (!entry || !entry.stationId) continue;
      const value = Number(entry.currentLevel ?? 0) || 0;
      map.set(entry.stationId, Math.max(0, value));
    }
    return map;
  }, [stationProgress]);

  function handleAdjustItem(item: AggregatedHideoutItem, delta: number) {
    if (!delta || !item || !Array.isArray(item.requirements) || item.requirements.length === 0) return;

    const maxTotal = item.totalRequired;
    if (maxTotal <= 0) return;

    const perReqCurrent: { req: RequirementPerStationLevel; collected: number }[] = [];
    let currentTotal = 0;

    for (const req of item.requirements) {
      const key = `${req.stationId}|${req.levelId}|${req.itemId}`;
      const delivered = perStationItemProgress.get(key) ?? 0;
      const clamped = Math.max(0, Math.min(req.requiredCount, delivered));
      perReqCurrent.push({ req, collected: clamped });
      currentTotal += clamped;
    }

    const minDelta = -currentTotal;
    const maxDelta = maxTotal - currentTotal;
    if (maxDelta === 0 && delta > 0) return;
    if (minDelta === 0 && delta < 0) return;

    const effectiveDelta = Math.max(minDelta, Math.min(maxDelta, delta));
    if (!effectiveDelta) return;

    const applyStep = (step: number) => {
      if (step > 0) {
        for (const entry of perReqCurrent) {
          if (entry.collected < entry.req.requiredCount) {
            entry.collected += 1;
            return;
          }
        }
      } else if (step < 0) {
        for (let i = perReqCurrent.length - 1; i >= 0; i -= 1) {
          const entry = perReqCurrent[i];
          if (entry.collected > 0) {
            entry.collected -= 1;
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

    setItemProgress((prev) => {
      const byKey = new Map<string, StationItemProgressEntry>();
      for (const entry of prev) {
        const key = `${entry.stationId}|${entry.levelId}|${entry.itemId}`;
        byKey.set(key, { ...entry });
      }

      for (const entry of perReqCurrent) {
        const { req, collected } = entry;
        const key = `${req.stationId}|${req.levelId}|${req.itemId}`;
        if (collected <= 0) {
          byKey.delete(key);
        } else {
          byKey.set(key, {
            stationId: req.stationId,
            levelId: req.levelId,
            itemId: req.itemId,
            collected,
          });
        }
      }

      return Array.from(byKey.values());
    });
  }

  function handleMarkToggle(item: AggregatedHideoutItem, markFound: boolean) {
    if (!item) return;

    const maxTotal = item.totalRequired;
    if (maxTotal <= 0) return;

    let currentTotal = 0;
    for (const req of item.requirements) {
      const key = `${req.stationId}|${req.levelId}|${req.itemId}`;
      const delivered = perStationItemProgress.get(key) ?? 0;
      const clamped = Math.max(0, Math.min(req.requiredCount, delivered));
      currentTotal += clamped;
    }

    const targetTotal = markFound ? maxTotal : 0;
    const delta = targetTotal - currentTotal;
    if (!delta) return;

    handleAdjustItem(item, delta);
  }

  function handleToggleMoneyRequirement(
    stationId: string,
    levelId: string,
    itemId: string,
    markCompleted: boolean,
  ) {
    const target = markCompleted ? 1 : 0;

    setItemProgress((prev) => {
      const keyToUpdate = `${stationId}|${levelId}|${itemId}`;
      const byKey = new Map<string, StationItemProgressEntry>();

      for (const entry of prev) {
        const key = `${entry.stationId}|${entry.levelId}|${entry.itemId}`;
        byKey.set(key, { ...entry });
      }

      if (target <= 0) {
        byKey.delete(keyToUpdate);
      } else {
        byKey.set(keyToUpdate, {
          stationId,
          levelId,
          itemId,
          collected: target,
        });
      }

      return Array.from(byKey.values());
    });
  }

  function handleAdjustItemFromStation(
    stationId: string,
    levelId: string,
    itemId: string,
    delta: number,
    maxCount: number,
  ) {
    if (!delta || maxCount <= 0) return;

    const key = `${stationId}|${levelId}|${itemId}`;
    const current = perStationItemProgress.get(key) ?? 0;

    const minDelta = -current;
    const maxDelta = maxCount - current;
    if (maxDelta === 0 && delta > 0) return;
    if (minDelta === 0 && delta < 0) return;

    const effectiveDelta = Math.max(minDelta, Math.min(maxDelta, delta));
    if (!effectiveDelta) return;

    const next = current + effectiveDelta;

    setItemProgress((prev) => {
      const byKey = new Map<string, StationItemProgressEntry>();
      for (const entry of prev) {
        const k = `${entry.stationId}|${entry.levelId}|${entry.itemId}`;
        byKey.set(k, { ...entry });
      }

      if (next <= 0) {
        byKey.delete(key);
      } else {
        byKey.set(key, {
          stationId,
          levelId,
          itemId,
          collected: next,
        });
      }

      return Array.from(byKey.values());
    });
  }

  function adjustStationLevel(stationId: string, delta: number, maxLevel: number) {
    if (!delta || maxLevel <= 0) return;

    const current = stationProgressById.get(stationId) ?? 0;
    const next = Math.max(0, Math.min(maxLevel, current + delta));
    if (next === current) return;

    setStationProgress((prev) => {
      const byId = new Map<string, StationProgressEntry>();
      for (const entry of prev) {
        byId.set(entry.stationId, { ...entry });
      }

      byId.set(stationId, { stationId, currentLevel: next });

      return Array.from(byId.values());
    });
  }

  const aggregatedItems = useMemo<AggregatedHideoutItem[]>(() => {
    if (stations.length === 0) return [];

    const byItemId = new Map<string, AggregatedHideoutItem>();

    for (const station of stations) {
      const stationId = String(station.id);
      const stationName = String(station.name ?? "Station");

      if (!Array.isArray(station.levels)) continue;

      for (const level of station.levels) {
        const levelNumber = typeof level.level === "number" ? level.level : 1;

        if (!Array.isArray(level.itemRequirements)) continue;

        for (const req of level.itemRequirements) {
          if (!req || !req.item || !req.item.id) continue;

          const name = String(req.item.name ?? "Item");
          const shortName = req.item.shortName ? String(req.item.shortName) : undefined;

          if (isCurrencyItem(name, shortName)) continue;

          const quantity =
            typeof req.quantity === "number" && !Number.isNaN(req.quantity) ? req.quantity : null;
          const baseCount =
            typeof req.count === "number" && !Number.isNaN(req.count) ? req.count : null;

          const count = (quantity ?? baseCount ?? 1) > 0 ? (quantity ?? baseCount ?? 1) : 1;

          const itemId = String(req.item.id);
          const iconLink = req.item.iconLink ? String(req.item.iconLink) : undefined;
          const wikiLink = req.item.wikiLink ? String(req.item.wikiLink) : undefined;

          const keyName = normalizeItemKey(name);
          const keyShort = normalizeItemKey(shortName);
          const fir =
            (!!keyName && wikiFirKeySet.has(keyName)) || (!!keyShort && wikiFirKeySet.has(keyShort));

          const requirement: RequirementPerStationLevel = {
            stationId,
            stationName,
            stationLevel: levelNumber,
            levelId: String(level.id),
            itemId,
            requiredCount: count,
            requiresFir: fir,
          };

          const existing = byItemId.get(itemId);
          if (!existing) {
            byItemId.set(itemId, {
              itemId,
              name,
              shortName,
              iconLink,
              wikiLink,
              totalRequired: count,
              totalCollected: 0,
              requirements: [requirement],
            });
          } else {
            existing.totalRequired += count;
            existing.requirements.push(requirement);
          }
        }
      }
    }

    for (const item of byItemId.values()) {
      const progress = aggregatedItemProgressById.get(item.itemId) ?? 0;
      item.totalCollected = Math.max(0, Math.min(item.totalRequired, progress));
    }

    const items = Array.from(byItemId.values());
    items.sort((a, b) => a.name.localeCompare(b.name));
    return items;
  }, [stations, aggregatedItemProgressById, wikiFirKeySet]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return aggregatedItems.filter((item) => {
      const isFound = item.totalCollected >= item.totalRequired && item.totalRequired > 0;

      if (itemsTab === "needed" && isFound) return false;
      if (itemsTab === "found" && !isFound) return false;

      if (firOnly && !item.requirements.some((req) => req.requiresFir)) return false;

      if (!normalizedQuery) return true;

      const haystack = `${item.name} ${item.shortName ?? ""}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [aggregatedItems, itemsTab, firOnly, query]);

  const overallStats = useMemo(() => {
    const totalItems = filteredItems.length;
    const totalRequiredUnits = filteredItems.reduce((sum, item) => sum + item.totalRequired, 0);
    const totalCollectedUnits = filteredItems.reduce((sum, item) => sum + item.totalCollected, 0);
    const totalRemainingUnits = Math.max(totalRequiredUnits - totalCollectedUnits, 0);

    return {
      totalItems,
      totalRequiredUnits,
      totalCollectedUnits,
      totalRemainingUnits,
    };
  }, [filteredItems]);

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

      for (const item of aggregatedItems) {
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
  }, [aggregatedItems, overallStats]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const payload = JSON.stringify(overallStats);
      window.localStorage.setItem("hideoutItemsSummary", payload);
    } catch {
      // ignore localStorage errors
    }
  }, [overallStats]);

  useEffect(() => {
    let cancelled = false;

    async function loadTeamNeeds() {
      setTeamNeedsLoading(true);
      setTeamNeedsError(null);

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

        const needsRes = await fetch(`/api/teams/${activeTeam.id}/needs`, {
          method: "GET",
          credentials: "include",
        });

        const data = await needsRes.json().catch(() => null);

        if (!needsRes.ok) {
          const message = (data && (data.error as string)) || "Failed to load team needs";
          if (!cancelled) {
            setTeamNeedsError(message);
          }
          return;
        }

        const needs = data as
          | {
              teamId?: string;
              items?: TeamNeedItem[];
            }
          | null;

        if (!needs || !needs.teamId || !Array.isArray(needs.items)) return;
        if (cancelled) return;

        setTeamNeeds({
          teamId: needs.teamId,
          items: needs.items.map((item) => ({
            itemId: String(item.itemId),
            name: String(item.name),
            shortName: item.shortName ? String(item.shortName) : undefined,
            iconLink: item.iconLink ? String(item.iconLink) : undefined,
            wikiLink: item.wikiLink ? String(item.wikiLink) : undefined,
            requiresFir: Boolean(item.requiresFir),
            totalRequired: Number(item.totalRequired ?? 0) || 0,
            totalCollected: Number(item.totalCollected ?? 0) || 0,
            members: Array.isArray(item.members)
              ? item.members.map((member) => ({
                  userId: String(member.userId),
                  username: member.username ?? null,
                  role: member.role ?? null,
                  required: Number(member.required ?? 0) || 0,
                  collected: Number(member.collected ?? 0) || 0,
                }))
              : [],
          })),
        });
      } catch {
        if (!cancelled) {
          setTeamNeedsError("Failed to load team needs");
        }
      } finally {
        if (!cancelled) {
          setTeamNeedsLoading(false);
        }
      }
    }

    void loadTeamNeeds();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (aggregatedItems.length === 0) return;

    async function syncHideoutItems() {
      try {
        await fetch("/api/hideout/items", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            items: aggregatedItems.map((item) => ({
              itemId: item.itemId,
              name: item.name,
              shortName: item.shortName,
              iconLink: item.iconLink,
              wikiLink: item.wikiLink,
              requiresFir: item.requirements.some((req) => req.requiresFir),
              totalRequired: item.totalRequired,
              totalCollected: item.totalCollected,
            })),
          }),
        });
      } catch (error) {
        console.error("Failed to sync hideout items", error);
      }
    }

    void syncHideoutItems();
  }, [aggregatedItems]);

  return (
    <AppShell
      title="Hideout items"
      subtitle="Track hideout construction and upgrade item requirements."
    >
      <section className="space-y-4">
        {/* ... */}

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 rounded-lg border border-zinc-800/80 bg-zinc-950/80 px-3 py-1.5 text-sm text-zinc-100 focus-within:border-emerald-500/60 focus-within:ring-1 focus-within:ring-emerald-500/40">
              <Search className="h-3.5 w-3.5 text-zinc-500" />
              <input
                placeholder="Search hideout items or stations"
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
                onClick={() => setView("stations")}
                className={`rounded-full px-3 py-1 ${
                  view === "stations" ? "bg-emerald-600 text-emerald-50" : "text-zinc-300"
                }`}
              >
                Stations
              </button>
              <button
                type="button"
                onClick={() => setView("items")}
                className={`rounded-full px-3 py-1 ${
                  view === "items" ? "bg-emerald-600 text-emerald-50" : "text-zinc-300"
                }`}
              >
                Items
              </button>
            </div>

            {view === "items" ? (
              <>
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
              </>
            ) : null}

            {view === "stations" ? (
              <div className="inline-flex rounded-full bg-zinc-900/80 p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setStationStatusFilter("active")}
                  className={`rounded-full px-3 py-1 ${
                    stationStatusFilter === "active" ? "bg-emerald-600 text-emerald-50" : "text-zinc-300"
                  }`}
                >
                  Active
                </button>
                <button
                  type="button"
                  onClick={() => setStationStatusFilter("locked")}
                  className={`rounded-full px-3 py-1 ${
                    stationStatusFilter === "locked" ? "bg-emerald-600 text-emerald-50" : "text-zinc-300"
                  }`}
                >
                  Locked
                </button>
                <button
                  type="button"
                  onClick={() => setStationStatusFilter("maxed")}
                  className={`rounded-full px-3 py-1 ${
                    stationStatusFilter === "maxed" ? "bg-emerald-600 text-emerald-50" : "text-zinc-300"
                  }`}
                >
                  Maxed
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <Card className="border border-zinc-800/80 bg-zinc-950/80">
          <CardHeader className="flex items-center gap-2 pb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-300">
              <Boxes className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
                Hideout items overview
              </CardTitle>
              <CardDescription className="text-[11px] text-emerald-100/80">
                {overallStats.totalItems} items · {overallStats.totalRemainingUnits}/
                {overallStats.totalRequiredUnits} units remaining
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <ProgressBar
              value={percentage(overallStats.totalCollectedUnits, overallStats.totalRequiredUnits || 1)}
              showLabel
            />
            <p className="text-[11px] text-emerald-100/80">
              {overallStats.totalCollectedUnits}/{overallStats.totalRequiredUnits} units secured
            </p>
          </CardContent>
        </Card>

        {error ? <p className="text-xs text-red-400">{error}</p> : null}
        {teamNeedsError ? (
          <p className="text-[11px] text-rose-400">{teamNeedsError}</p>
        ) : null}

        {view === "items" && filteredItems.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredItems.map((item) => {
              const isFound = item.totalCollected >= item.totalRequired && item.totalRequired > 0;
              const teamNeedsEntry =
                teamNeeds && Array.isArray(teamNeeds.items)
                  ? teamNeeds.items.find((teamItem) => teamItem.itemId === item.itemId)
                  : undefined;

              return (
                <Card key={item.itemId} interactive className="h-full border-zinc-900/80 bg-zinc-950/85">
                  <CardHeader className="flex flex-col gap-1 pb-2">
                    <div className="flex items-center gap-2">
                      {item.iconLink ? (
                        <img
                          src={item.iconLink}
                          alt={item.name}
                          loading="lazy"
                          className="h-16 w-16 flex-shrink-0 rounded border border-zinc-800 bg-zinc-900 object-contain"
                        />
                      ) : null}
                      <div className="min-w-0">
                        <CardTitle className="truncate text-base font-semibold text-zinc-100">
                          {item.shortName || item.name}
                        </CardTitle>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[9px] text-zinc-500">
                          <span className="rounded-full border border-zinc-700/80 bg-zinc-900/80 px-2 py-[1px]">
                            Hideout item
                          </span>
                          {item.requirements.some((req) => req.requiresFir) ? (
                            <Badge
                              variant="muted"
                              className="border-emerald-500/60 bg-emerald-500/10 text-[9px] text-emerald-300"
                            >
                              FIR
                            </Badge>
                          ) : null}
                          {teamNeedsEntry && teamNeedsEntry.members.length > 0 ? (
                            <div className="mt-0.5 flex flex-wrap gap-1 text-[9px] text-zinc-500">
                              <span className="text-zinc-500">Team:</span>
                              {teamNeedsEntry.members.map((member) => {
                                if (!member.userId) return null;

                                const remaining = Math.max(member.required - member.collected, 0);
                                let icon: JSX.Element | null = null;
                                if (member.required > 0) {
                                  if (remaining === 0) {
                                    icon = <Check className="h-3 w-3 text-emerald-400" />;
                                  } else if (member.collected > 0) {
                                    icon = <Clock className="h-3 w-3 text-amber-300" />;
                                  } else {
                                    icon = <Lock className="h-3 w-3 text-zinc-500" />;
                                  }
                                }

                                return (
                                  <span
                                    key={member.userId}
                                    className="inline-flex items-center gap-1 rounded-full bg-zinc-900/80 px-1.5 py-[1px]"
                                  >
                                    <span className="max-w-[4.5rem] truncate">
                                      {member.username || "Anon"}
                                    </span>
                                    <span className="text-zinc-400">
                                      {member.collected}/{member.required}
                                    </span>
                                    {icon}
                                  </span>
                                );
                              })}
                              {teamNeedsLoading ? (
                                <span className="ml-1 text-[9px] text-zinc-500">(loading…)</span>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 pt-0">
                    <div className="flex items-center justify-between text-[11px] text-zinc-400">
                      <span>Progress</span>
                      <div className="flex items-center gap-1">
                        {/* ... */}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-6 px-1 text-[10px]"
                          onClick={() => handleAdjustItem(item, -1)}
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
                          onClick={() => handleAdjustItem(item, 1)}
                        >
                          +
                        </Button>
                      </div>
                    </div>
                    <ProgressBar value={percentage(item.totalCollected, item.totalRequired || 1)} />
                    <div className="flex items-center justify-between text-[10px] text-zinc-500">
                      <span>
                        Used in {new Set(item.requirements.map((req) => req.stationId)).size} station
                        {new Set(item.requirements.map((req) => req.stationId)).size === 1 ? "" : "s"}
                      </span>
                      <Button
                        size="sm"
                        variant={isFound ? "outline" : "primary"}
                        onClick={() => handleMarkToggle(item, !isFound)}
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
        ) : null}

        {view === "stations" && stations.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {stations.map((station) => {
              const normalizedQuery = query.trim().toLowerCase();
              if (normalizedQuery) {
                const haystack = `${station.name} ${station.normalizedName ?? ""}`.toLowerCase();
                if (!haystack.includes(normalizedQuery)) return null;
              }

              const levels = Array.isArray(station.levels)
                ? [...station.levels].sort((a, b) => (a.level ?? 0) - (b.level ?? 0))
                : [];

              const maxLevel = levels.reduce(
                (max, level) => (typeof level.level === "number" && level.level > max ? level.level : max),
                0,
              );
              const currentLevel = stationProgressById.get(String(station.id)) ?? 0;

              const targetLevel = maxLevel > 0 ? Math.min(currentLevel + 1, maxLevel) : 0;
              const targetLevelData =
                levels.find((lvl) => (lvl.level ?? 0) === targetLevel) ||
                (levels.length > 0 ? levels[levels.length - 1] : undefined);

              let prereqsMet = true;
              if (targetLevelData) {
                if (
                  Array.isArray(targetLevelData.stationLevelRequirements) &&
                  targetLevelData.stationLevelRequirements.length > 0
                ) {
                  for (const req of targetLevelData.stationLevelRequirements) {
                    const requiredLevel = req.level ?? 1;
                    const reqStationId = req.station?.id ? String(req.station.id) : String(station.id);
                    const reqCurrentLevel = stationProgressById.get(reqStationId) ?? 0;
                    if (reqCurrentLevel < requiredLevel) {
                      prereqsMet = false;
                      break;
                    }
                  }
                }

                if (
                  prereqsMet &&
                  Array.isArray(targetLevelData.traderRequirements) &&
                  targetLevelData.traderRequirements.length > 0
                ) {
                  for (const req of targetLevelData.traderRequirements) {
                    const type = (req.requirementType || "").toString();
                    const value =
                      typeof req.value === "number" && !Number.isNaN(req.value) ? req.value : undefined;
                    const traderNameRaw = req.trader?.name;
                    const traderName =
                      typeof traderNameRaw === "string" && traderNameRaw.trim().length > 0
                        ? traderNameRaw.trim()
                        : undefined;

                    if (type === "loyaltyLevel" && value !== undefined && traderName) {
                      const levels = traderLevelsByName;
                      const currentLevel =
                        levels && typeof levels[traderName] === "number"
                          ? levels[traderName]
                          : undefined;

                      if (!currentLevel || Number.isNaN(currentLevel) || currentLevel < value) {
                        prereqsMet = false;
                        break;
                      }
                    }
                  }
                }
              }

              const isMaxed = maxLevel > 0 && currentLevel >= maxLevel;
              const isActive = !isMaxed && prereqsMet && maxLevel > 0;
              const isLocked = !isMaxed && !isActive;

              if (stationStatusFilter === "active" && !isActive) return null;
              if (stationStatusFilter === "locked" && !isLocked) return null;
              if (stationStatusFilter === "maxed" && !isMaxed) return null;

              return (
                <Card key={station.id} className="border-zinc-900/80 bg-zinc-950/85">
                  <CardHeader className="flex items-center justify-between pb-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-emerald-300">
                        <Wrench className="h-4 w-4" />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-semibold text-zinc-100">
                          {station.name}
                        </CardTitle>
                        <p className="text-[10px] text-zinc-500">
                          Current: {currentLevel}/{maxLevel || 0}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0 text-[11px] text-zinc-300">
                    {levels.length === 0 || !targetLevelData ? (
                      <p className="text-[10px] text-zinc-500">No levels data available.</p>
                    ) : (
                      <>
                        <div className="mb-1 flex items-center justify-between text-[10px] text-zinc-400">
                          <span className="uppercase tracking-[0.16em] text-zinc-500">
                            Requirements for level {targetLevelData.level ?? targetLevel}
                          </span>
                          <span className="text-zinc-500">
                            Target: {targetLevelData.level ?? targetLevel}/{maxLevel || 0}
                          </span>
                        </div>

                        {Array.isArray(targetLevelData.stationLevelRequirements) &&
                        targetLevelData.stationLevelRequirements.length > 0 ? (
                          <div className="space-y-1">
                            {targetLevelData.stationLevelRequirements.map((req) => {
                              const requiredLevel = req.level ?? 1;
                              const reqStationName = req.station?.name ?? "Unknown station";
                              const reqStationId = req.station?.id ? String(req.station.id) : undefined;
                              const reqCurrentLevel = reqStationId
                                ? stationProgressById.get(reqStationId) ?? 0
                                : 0;
                              const fulfilled = reqCurrentLevel >= requiredLevel;

                              return (
                                <div
                                  key={req.id}
                                  className="flex items-center justify-between rounded-md bg-zinc-950/70 px-2 py-1"
                                >
                                  <div className="flex min-w-0 items-center gap-2">
                                    <div className="flex h-4 w-4 items-center justify-center rounded bg-zinc-900 text-zinc-400">
                                      <Wrench className="h-3 w-3" />
                                    </div>
                                    <p className="truncate text-[11px] text-zinc-100">{reqStationName}</p>
                                  </div>
                                  <span
                                    className={
                                      fulfilled
                                        ? "text-[10px] font-medium text-emerald-400"
                                        : "text-[10px] text-zinc-400"
                                    }
                                  >
                                    Lvl {requiredLevel}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        ) : null}

                        {Array.isArray(targetLevelData.itemRequirements) &&
                        targetLevelData.itemRequirements.length > 0 ? (
                          <div className="mt-1 space-y-1">
                            {targetLevelData.itemRequirements.map((req, index) => {
                              if (!req || !req.item || !req.item.id) return null;

                              const name = String(req.item.name ?? "Item");
                              const shortName = req.item.shortName
                                ? String(req.item.shortName)
                                : undefined;

                              const itemId = String(req.item.id);
                              const perStationKey = `${station.id}|${targetLevelData.id}|${itemId}`;
                              const deliveredHere = perStationItemProgress.get(perStationKey) ?? 0;

                              const isMoney = isCurrencyItem(name, shortName);
                              if (isMoney) {
                                const paid = deliveredHere > 0;

                                return (
                                  <div
                                    key={`${itemId}-${index}`}
                                    className="flex items-center justify-between rounded-md bg-zinc-950/60 px-2 py-1"
                                  >
                                    <div className="min-w-0">
                                      <p className="truncate text-[11px] text-zinc-100">{shortName || name}</p>
                                    </div>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant={paid ? "outline" : "primary"}
                                      className="h-6 px-2 text-[10px]"
                                      onClick={() =>
                                        handleToggleMoneyRequirement(
                                          String(station.id),
                                          String(targetLevelData.id),
                                          itemId,
                                          !paid,
                                        )
                                      }
                                    >
                                      {paid ? "Completed" : "Mark completed"}
                                    </Button>
                                  </div>
                                );
                              }

                              const quantity =
                                typeof req.quantity === "number" && !Number.isNaN(req.quantity)
                                  ? req.quantity
                                  : null;
                              const baseCount =
                                typeof req.count === "number" && !Number.isNaN(req.count) ? req.count : null;

                              const count = (quantity ?? baseCount ?? 1) > 0 ? (quantity ?? baseCount ?? 1) : 1;
                              const clamped = Math.max(0, Math.min(count, deliveredHere));

                              const keyName = normalizeItemKey(name);
                              const keyShort = normalizeItemKey(shortName);
                              const firHere =
                                (!!keyName && wikiFirKeySet.has(keyName)) ||
                                (!!keyShort && wikiFirKeySet.has(keyShort));

                              const iconLink = req.item.iconLink ? String(req.item.iconLink) : undefined;

                              return (
                                <div
                                  key={`${itemId}-${index}`}
                                  className="flex items-center justify-between rounded-md bg-zinc-950/60 px-2 py-1"
                                >
                                  <div className="flex min-w-0 items-center gap-2">
                                    {iconLink ? (
                                      <img
                                        src={iconLink}
                                        alt={shortName || name}
                                        loading="lazy"
                                        className="h-6 w-6 flex-shrink-0 rounded border border-zinc-800 bg-zinc-900 object-contain"
                                      />
                                    ) : null}
                                    <div className="min-w-0">
                                      <p className="truncate text-[11px] text-zinc-100 flex items-center gap-1">
                                        <span>{shortName || name}</span>
                                        {firHere ? (
                                          <span className="rounded-full bg-red-500/10 px-1.5 py-px text-[8px] font-semibold uppercase tracking-[0.12em] text-red-300">
                                            FIR
                                          </span>
                                        ) : null}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex flex-col items-end gap-1 text-[10px] text-zinc-400">
                                    <div className="flex items-center gap-1">
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="h-4 w-4 p-0 text-[9px]"
                                        onClick={() =>
                                          handleAdjustItemFromStation(
                                            String(station.id),
                                            String(targetLevelData.id),
                                            itemId,
                                            -1,
                                            count,
                                          )
                                        }
                                      >
                                        -
                                      </Button>
                                      <span>
                                        {clamped}/{count}
                                      </span>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="h-4 w-4 p-0 text-[9px]"
                                        onClick={() =>
                                          handleAdjustItemFromStation(
                                            String(station.id),
                                            String(targetLevelData.id),
                                            itemId,
                                            1,
                                            count,
                                          )
                                        }
                                      >
                                        +
                                      </Button>
                                    </div>
                                    <div className="h-1.5 w-20 overflow-hidden rounded-full bg-zinc-800">
                                      <div
                                        className="h-full bg-emerald-500"
                                        style={{ width: `${percentage(clamped, count || 1)}%` }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-[10px] text-zinc-500">No item requirements.</p>
                        )}

                        {Array.isArray(targetLevelData.traderRequirements) &&
                        targetLevelData.traderRequirements.length > 0 ? (
                          <div className="mt-1 space-y-0.5 text-[10px] text-zinc-400">
                            {targetLevelData.traderRequirements.map((req) => {
                              const type = (req.requirementType || "").toString();
                              const value =
                                typeof req.value === "number" && !Number.isNaN(req.value) ? req.value : undefined;
                              const traderNameRaw = req.trader?.name;
                              const traderName =
                                typeof traderNameRaw === "string" && traderNameRaw.trim().length > 0
                                  ? traderNameRaw.trim()
                                  : undefined;

                              if (type === "loyaltyLevel" && value !== undefined && traderName) {
                                const levels = traderLevelsByName;
                                const currentLevelRaw =
                                  levels && typeof levels[traderName] === "number"
                                    ? levels[traderName]
                                    : undefined;
                                const hasCurrent =
                                  typeof currentLevelRaw === "number" && !Number.isNaN(currentLevelRaw);
                                const meets = hasCurrent && (currentLevelRaw as number) >= value;

                                return (
                                  <p key={req.id}>
                                    Trader: {traderName} LL{value}
                                    {hasCurrent ? (
                                      <span
                                        className={
                                          meets
                                            ? "ml-1 text-emerald-400"
                                            : "ml-1 text-amber-300"
                                        }
                                      >
                                        (you: LL{currentLevelRaw})
                                      </span>
                                    ) : null}
                                  </p>
                                );
                              }

                              if (type === "playerLevel" && value !== undefined) {
                                return (
                                  <p key={req.id}>
                                    Player level {value}
                                  </p>
                                );
                              }

                              return null;
                            })}
                          </div>
                        ) : null}
                      </>
                    )}

                    <div className="pt-2 flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 w-24 text-[11px] font-semibold"
                        disabled={currentLevel <= 0}
                        onClick={() => adjustStationLevel(String(station.id), -1, maxLevel)}
                      >
                        Downgrade
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={isMaxed ? "outline" : "primary"}
                        className="h-8 flex-1 text-[11px] font-semibold"
                        disabled={isMaxed || maxLevel <= 0 || isLocked}
                        onClick={() => adjustStationLevel(String(station.id), 1, maxLevel)}
                      >
                        {isMaxed ? "Maxed" : isLocked ? "Locked" : "Upgrade"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}
