import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { findUserById } from "@/lib/db";

export const runtime = "nodejs";

const TASKS_SUMMARY_QUERY = `
  query TasksSummary {
    tasks {
      id
      name
      kappaRequired
      trader {
        name
      }
      map {
        name
      }
    }
  }
`;

async function getCurrentUser() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("userId")?.value;
  if (!userId) return null;
  const user = await findUserById(userId);
  return user ?? null;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let rawTasks: any[] | null = null;

  try {
    const response = await fetch("https://api.tarkov.dev/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: TASKS_SUMMARY_QUERY }),
      next: { revalidate: 60 * 60 },
    });

    const result = await response.json().catch(() => null);

    if (!response.ok || !result || !result.data || !Array.isArray(result.data.tasks)) {
      return NextResponse.json({ error: "failed to load tasks from tarkov.dev" }, { status: 502 });
    }

    rawTasks = result.data.tasks as any[];
  } catch {
    return NextResponse.json({ error: "failed to load tasks from tarkov.dev" }, { status: 502 });
  }

  const statusByQuestId = new Map<string, string>();

  if (Array.isArray(user.quests)) {
    for (const qp of user.quests) {
      if (!qp || !qp.questId) continue;
      statusByQuestId.set(String(qp.questId), String(qp.status));
    }
  }

  let totalQuests = 0;
  let completedQuests = 0;
  let totalKappaQuests = 0;
  let completedKappaQuests = 0;

  const tasks = rawTasks.map((task) => {
    const id = String(task?.id ?? "");
    const name = String(task?.name ?? "Unknown task");
    const traderName = String(task?.trader?.name ?? "Unknown trader");
    const mapName = String(task?.map?.name ?? "Any");
    const kappaRequired = Boolean(task?.kappaRequired);

    if (id) {
      totalQuests += 1;
      if (kappaRequired) totalKappaQuests += 1;
    }

    const rawStatus = id ? statusByQuestId.get(id) : undefined;
    const isCompleted = rawStatus === "completed";

    if (isCompleted) {
      completedQuests += 1;
      if (kappaRequired) completedKappaQuests += 1;
    }

    return {
      id,
      name,
      trader: traderName,
      map: mapName,
      kappaRequired,
      status: rawStatus ?? null,
    };
  });

  return NextResponse.json({
    tasks,
    stats: {
      totalQuests,
      completedQuests,
      totalKappaQuests,
      completedKappaQuests,
    },
  });
}
