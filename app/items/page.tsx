"use client";

import { useMemo, useState, useEffect, type ChangeEvent } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ITEMS } from "@/lib/sample-data";
import type { Item, ItemRarity } from "@/lib/types/item";
import { percentage } from "@/lib/utils";
import { Boxes, Search } from "lucide-react";

const RARITY_LABEL: Record<ItemRarity, string> = {
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
};

const RARITY_BADGE_VARIANT: Record<ItemRarity, BadgeVariant> = {
  common: "muted",
  rare: "outline",
  epic: "warning",
  legendary: "danger",
};

export default function ItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [query, setQuery] = useState("");
  const [kappaOnly, setKappaOnly] = useState(true);
  const [foundInRaidOnly, setFoundInRaidOnly] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem("questItemsData");
      if (raw) {
        const parsed = JSON.parse(raw) as Item[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setItems(parsed);
          return;
        }
      }
    } catch (e) {
      console.error("Failed to load quest items data", e);
    }
    
    // Fallback to sample data if nothing in local storage (or allow empty)
    // setItems(ITEMS); 
    // Actually, let's start with empty or sample if we want. 
    // If the dashboard hasn't run yet, we might want to show nothing or a message.
    // But for better UX let's fallback to sample if empty? No, sample data is misleading.
    // Let's rely on the dashboard having run.
    setItems([]);
  }, []);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return items.filter((item) => {
      if (kappaOnly && !item.neededForKappa) return false;
      if (foundInRaidOnly && !item.foundInRaid) return false;

      if (!normalizedQuery) return true;

      const haystack = `${item.name} ${item.category}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [items, query, kappaOnly, foundInRaidOnly]);

  const totalRequired = filtered.reduce(
    (sum, item) => sum + item.quantityRequired,
    0,
  );
  const totalOwned = filtered.reduce(
    (sum, item) => sum + item.quantityOwned,
    0,
  );

  return (
    <AppShell
      title="Items"
      subtitle="Track Kappa-critical items and stash progress at a glance."
    >
      <section className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 rounded-lg border border-zinc-800/80 bg-zinc-950/80 px-3 py-1.5 text-sm text-zinc-100 focus-within:border-emerald-500/60 focus-within:ring-1 focus-within:ring-emerald-500/40">
              <Search className="h-3.5 w-3.5 text-zinc-500" />
              <input
                placeholder="Search by name or category"
                className="h-7 w-full bg-transparent text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
                value={query}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setQuery(event.target.value)
                }
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-zinc-800/80 bg-zinc-950/80 px-3 py-1 text-[11px] text-zinc-300">
              <input
                type="checkbox"
                className="h-3 w-3 rounded border-zinc-700 bg-transparent text-emerald-500"
                checked={kappaOnly}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setKappaOnly(event.target.checked)
                }
              />
              <span>Kappa only</span>
            </label>

            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-zinc-800/80 bg-zinc-950/80 px-3 py-1 text-[11px] text-zinc-300">
              <input
                type="checkbox"
                className="h-3 w-3 rounded border-zinc-700 bg-transparent text-emerald-500"
                checked={foundInRaidOnly}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setFoundInRaidOnly(event.target.checked)
                }
              />
              <span>Found in raid</span>
            </label>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Card className="col-span-full border border-emerald-600/60 bg-gradient-to-r from-emerald-500/15 via-emerald-500/5 to-transparent">
            <CardHeader className="flex items-center gap-2 pb-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-300">
                <Boxes className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
                  Overall stash progress
                </CardTitle>
                <CardDescription className="text-[11px] text-emerald-100/80">
                  Across all filtered items required for your current view.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <ProgressBar
                value={percentage(totalOwned, totalRequired || 1)}
                showLabel
              />
              <p className="text-[11px] text-emerald-100/80">
                {totalOwned}/{totalRequired} units secured
              </p>
            </CardContent>
          </Card>

          {filtered.map((item: Item) => {
            const qtyPct = percentage(item.quantityOwned, item.quantityRequired || 1);

            return (
              <Card key={item.id} interactive className="h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-sm font-semibold text-zinc-100">
                      {item.name}
                    </CardTitle>
                    <Badge
                      variant={RARITY_BADGE_VARIANT[item.rarity]}
                      className="text-[10px]"
                    >
                      {RARITY_LABEL[item.rarity]}
                    </Badge>
                  </div>
                  <CardDescription className="text-[11px] text-zinc-500">
                    {item.category}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-zinc-500">
                    <span>Quantity</span>
                    <span>
                      {item.quantityOwned}/{item.quantityRequired}
                    </span>
                  </div>
                  <ProgressBar value={qtyPct} />
                  <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                    {item.neededForKappa ? (
                      <Badge variant="success" className="text-[10px]">
                        Kappa
                      </Badge>
                    ) : null}
                    {item.foundInRaid ? (
                      <Badge variant="muted" className="text-[10px]">
                        Found in raid
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">
                        Not FIR
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </AppShell>
  );
}
