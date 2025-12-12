import type { Quest, QuestStatus } from "@/lib/types/quest";

interface QuestStatusBarProps {
  quests: Quest[];
}

const STATUS_ORDER: QuestStatus[] = ["completed", "available", "locked"];

const STATUS_COLORS: Record<QuestStatus, string> = {
  completed: "bg-emerald-500",
  in_progress: "bg-zinc-500", // treated as available
  available: "bg-zinc-500",
  locked: "bg-zinc-700",
};

const STATUS_LABELS: Record<QuestStatus, string> = {
  completed: "Completed",
  in_progress: "Available",
  available: "Available",
  locked: "Locked",
};

export function QuestStatusBar({ quests }: QuestStatusBarProps) {
  const total = quests.length || 1;

  const counts: Record<QuestStatus, number> = {
    completed: 0,
    in_progress: 0,
    available: 0,
    locked: 0,
  };

  for (const quest of quests) {
    const status: QuestStatus =
      quest.status === "in_progress" ? "available" : quest.status;
    counts[status] += 1;
  }

  const completed = counts.completed;

  return (
    <section
      aria-label="Quest status breakdown"
      className="mt-1 space-y-2 rounded-xl border border-zinc-900/80 bg-zinc-950/80 px-4 py-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
          Quest status
        </h2>
        <span className="text-[11px] text-zinc-500">
          {completed}/{quests.length} completed
        </span>
      </div>

      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-zinc-900/80">
        {STATUS_ORDER.map((status) => {
          const value = counts[status];
          if (!value) return null;
          const width = (value / total) * 100;

          return (
            <div
              key={status}
              className={`${STATUS_COLORS[status]} transition-[width] duration-500 ease-out`}
              style={{ width: `${width}%` }}
            />
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 text-[11px] text-zinc-500">
        {STATUS_ORDER.map((status) => {
          const value = counts[status];
          if (!value) return null;

          return (
            <div key={status} className="inline-flex items-center gap-1.5">
              <span
                className={`${STATUS_COLORS[status]} h-1.5 w-1.5 rounded-full`}
              />
              <span>
                {STATUS_LABELS[status]} · {value}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
