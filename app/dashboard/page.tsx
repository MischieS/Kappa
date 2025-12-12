import DashboardClient from "./DashboardClient";
import { getTasksRef } from "@/lib/server/tarkovClient";
import { cookies } from "next/headers";
import { getUserById } from "@/lib/repository/userRepository";

export const runtime = "nodejs";

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
  objectives: DashboardTaskObjective[];
}

interface TraderStandingSummary {
  traderId: string;
  level: number;
}

async function getInitialDashboardTasks(user: any | null): Promise<DashboardTaskSummary[] | null> {
  let tasks: any[] = [];

  try {
    const rawTasks = await getTasksRef();
    if (Array.isArray(rawTasks)) {
      tasks = rawTasks as any[];
    }
  } catch (error) {
    console.error("Failed to load dashboard tasks ref on server", error);
    return null;
  }

  const statusByQuestId = new Map<string, string>();

  if (user && Array.isArray(user.quests)) {
    for (const qp of user.quests) {
      if (!qp || !qp.questId) continue;
      statusByQuestId.set(String(qp.questId), String(qp.status));
    }
  }

  const summaries: DashboardTaskSummary[] = tasks.map((task) => {
    const id = String(task?.id ?? "");
    const name = String(task?.name ?? "Unknown task");
    const traderName = String(task?.trader?.name ?? "Unknown trader");
    const mapName = String(task?.map?.name ?? "Any");
    const kappaRequired = Boolean(task?.kappaRequired);
    const rawStatus = id ? statusByQuestId.get(id) ?? null : null;
    
    const objectives: DashboardTaskObjective[] = Array.isArray(task.objectives)
      ? task.objectives.map((obj: any) => ({
          type: String(obj.type),
          description: String(obj.description ?? ""),
          items: Array.isArray(obj.items)
            ? obj.items.map((i: any) => ({
                id: String(i.id),
                name: String(i.name),
                shortName: i.shortName ? String(i.shortName) : undefined,
                iconLink: i.iconLink ? String(i.iconLink) : undefined,
                wikiLink: i.wikiLink ? String(i.wikiLink) : undefined,
              }))
            : undefined,
          count: typeof obj.count === "number" ? obj.count : undefined,
          foundInRaid: typeof obj.foundInRaid === "boolean" ? obj.foundInRaid : undefined,
        }))
      : [];

    return {
      id,
      name,
      trader: traderName,
      map: mapName,
      kappaRequired,
      status: rawStatus,
      objectives,
    };
  });

  return summaries;
}

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("userId")?.value;

  // Parallel fetch: User Data & Task References
  const [user, rawTasks] = await Promise.all([
    userId ? getUserById(userId).catch(err => {
      console.error("Failed to load dashboard user on server", err);
      return null;
    }) : Promise.resolve(null),
    getTasksRef().catch(err => {
      console.error("Failed to load dashboard tasks ref on server", err);
      return [];
    })
  ]);

  // Compute Initial Tasks
  let initialTasks: DashboardTaskSummary[] = [];
  try {
    const tasks = Array.isArray(rawTasks) ? rawTasks : [];
    
    const statusByQuestId = new Map<string, string>();
    if (user && Array.isArray(user.quests)) {
      for (const qp of user.quests) {
        if (!qp || !qp.questId) continue;
        statusByQuestId.set(String(qp.questId), String(qp.status));
      }
    }

    initialTasks = tasks.map((task: any) => {
      const id = String(task?.id ?? "");
      const name = String(task?.name ?? "Unknown task");
      const traderName = String(task?.trader?.name ?? "Unknown trader");
      const mapName = String(task?.map?.name ?? "Any");
      const kappaRequired = Boolean(task?.kappaRequired);
      const rawStatus = id ? statusByQuestId.get(id) ?? null : null;
      
      const objectives: DashboardTaskObjective[] = Array.isArray(task.objectives)
        ? task.objectives.map((obj: any) => ({
            type: String(obj.type),
            description: String(obj.description ?? ""),
            items: Array.isArray(obj.items)
              ? obj.items.map((i: any) => ({
                  id: String(i.id),
                  name: String(i.name),
                  shortName: i.shortName ? String(i.shortName) : undefined,
                  iconLink: i.iconLink ? String(i.iconLink) : undefined,
                  wikiLink: i.wikiLink ? String(i.wikiLink) : undefined,
                }))
              : undefined,
            count: typeof obj.count === "number" ? obj.count : undefined,
            foundInRaid: typeof obj.foundInRaid === "boolean" ? obj.foundInRaid : undefined,
          }))
        : [];

      return {
        id,
        name,
        trader: traderName,
        map: mapName,
        kappaRequired,
        status: rawStatus,
        objectives,
      };
    });
  } catch (error) {
    console.error("Failed to build initial dashboard tasks on server", error);
  }

  let initialTraderStandings: TraderStandingSummary[] | null = null;
  if (user && Array.isArray(user.traderStandings)) {
    initialTraderStandings = user.traderStandings
      .filter((entry: any) => entry && entry.traderId)
      .map((entry: any) => ({
        traderId: String(entry.traderId),
        level: Number(entry.level ?? 1) || 1,
      }));
  }

  return <DashboardClient initialTasks={initialTasks} initialTraderStandings={initialTraderStandings} />;
}
