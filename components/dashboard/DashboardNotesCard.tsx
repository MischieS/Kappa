"use client";

import { useMemo, useState } from "react";
import type { Quest } from "@/lib/types/quest";
import type { Item } from "@/lib/types/item";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

interface DashboardNotesCardProps {
  quests: Quest[];
  items: Item[];
}

type PinnedType = "quest" | "item";

interface PinnedEntry {
  id: string;
  type: PinnedType;
  label: string;
  done: boolean;
}

export function DashboardNotesCard({ quests, items }: DashboardNotesCardProps) {
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const [pinned, setPinned] = useState<PinnedEntry[]>([]);

  const searchResults = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [] as PinnedEntry[];

    const questMatches: PinnedEntry[] = quests
      .filter((quest) => {
        const map = quest.map ?? "";
        return (
          quest.title.toLowerCase().includes(query) ||
          quest.trader.toLowerCase().includes(query) ||
          map.toLowerCase().includes(query)
        );
      })
      .slice(0, 5)
      .map((quest) => ({
        id: `quest:${quest.id}`,
        type: "quest" as const,
        label: `${quest.title} · ${quest.trader}`,
        done: false,
      }));

    const itemMatches: PinnedEntry[] = items
      .filter((item) => item.name.toLowerCase().includes(query))
      .slice(0, 5)
      .map((item) => ({
        id: `item:${item.id}`,
        type: "item" as const,
        label: item.name,
        done: false,
      }));

    return [...questMatches, ...itemMatches].slice(0, 8);
  }, [search, quests, items]);

  function togglePinned(entry: PinnedEntry) {
    setPinned((prev) => {
      const exists = prev.find((p) => p.id === entry.id);
      if (exists) {
        return prev.filter((p) => p.id !== entry.id);
      }
      return [...prev, entry];
    });
  }

  function toggleDone(id: string) {
    setPinned((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              done: !p.done,
            }
          : p,
      ),
    );
  }

  const hasPinned = pinned.length > 0;

  return (
    <Card className="h-full border-zinc-900/80 bg-zinc-950/90">
      <CardHeader className="flex items-center justify-between gap-3 pb-3">
        <CardTitle className="text-sm font-semibold text-zinc-100">Notes & pins</CardTitle>
        {hasPinned ? (
          <button
            type="button"
            onClick={() => setPinned([])}
            className="text-[10px] font-medium text-zinc-500 hover:text-zinc-300"
          >
            Clear pins
          </button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3 pb-4 text-xs text-zinc-200">
        {/* Free-form note */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Quick note
          </p>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Write reminders, raid plans, or stash cleanup notes."
            rows={3}
            className="w-full rounded-lg border border-zinc-800/80 bg-zinc-950/80 px-2.5 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/70"
          />
        </div>

        <div className="h-px bg-zinc-900/80" />

        {/* Pinned list */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Pinned
          </p>
          {hasPinned ? (
            <div className="space-y-1.5 rounded-xl border border-zinc-900/80 bg-zinc-950/80 p-2">
              {pinned.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => toggleDone(entry.id)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-1.5 py-1 text-left text-[11px] text-zinc-200 hover:bg-zinc-900/80"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex h-5 w-5 items-center justify-center rounded-full border text-[9px] font-semibold uppercase ${
                        entry.type === "quest"
                          ? "border-emerald-400/70 text-emerald-300"
                          : "border-sky-400/70 text-sky-300"
                      }`}
                    >
                      {entry.type === "quest" ? "Q" : "I"}
                    </span>
                    <span
                      className={entry.done ? "line-through text-zinc-500" : "text-zinc-100"}
                    >
                      {entry.label}
                    </span>
                  </div>
                  <span
                    className={`inline-flex h-4 w-4 items-center justify-center rounded border text-[9px] ${
                      entry.done
                        ? "border-emerald-400 bg-emerald-500/20 text-emerald-200"
                        : "border-zinc-700/80 bg-zinc-900/80 text-zinc-500"
                    }`}
                  >
                    {entry.done ? "✓" : ""}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-zinc-500">
              No pins yet. Search quests or items below to add some.
            </p>
          )}
        </div>

        <div className="h-px bg-zinc-900/80" />

        {/* Search & add pins */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Pin from quests & items
          </p>
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search quest or item name..."
            className="h-8 w-full rounded-lg border border-zinc-800/80 bg-zinc-950/80 px-2.5 text-[11px] text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/70"
          />
          {searchResults.length > 0 ? (
            <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-xl border border-zinc-900/80 bg-zinc-950/95 p-2">
              {searchResults.map((entry) => {
                const alreadyPinned = pinned.some((p) => p.id === entry.id);
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => togglePinned(entry)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-1.5 py-1 text-left text-[11px] text-zinc-200 hover:bg-zinc-900/80"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex h-5 w-5 items-center justify-center rounded-full border text-[9px] font-semibold uppercase ${
                          entry.type === "quest"
                            ? "border-emerald-400/70 text-emerald-300"
                            : "border-sky-400/70 text-sky-300"
                        }`}
                      >
                        {entry.type === "quest" ? "Q" : "I"}
                      </span>
                      <span className="truncate text-[11px] text-zinc-100">{entry.label}</span>
                    </div>
                    <span
                      className={`text-[10px] ${
                        alreadyPinned ? "text-emerald-300" : "text-zinc-500"
                      }`}
                    >
                      {alreadyPinned ? "Pinned" : "Pin"}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : search.trim() ? (
            <p className="text-[11px] text-zinc-500">No matches. Try another name.</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
