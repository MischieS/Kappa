import QuestItemsClient from "./QuestItemsClient";
import { getTasksRef } from "@/lib/server/tarkovClient";
import { cookies } from "next/headers";
import { getUserById } from "@/lib/repository/userRepository";

type InitialUserProgress = {
  quests?: { questId: string; status: string }[];
  objectives?: { questId: string; objectiveId: string; collected: number }[];
} | null;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getInitialUserProgress(): Promise<InitialUserProgress> {
  const cookieStore = await cookies();
  const userId = cookieStore.get("userId")?.value;
  if (!userId) return null;

  const user = await getUserById(userId);
  if (!user) return null;

  return {
    quests: Array.isArray(user.quests)
      ? user.quests.map((q) => ({ questId: q.questId, status: q.status }))
      : undefined,
    objectives: Array.isArray(user.objectiveProgress)
      ? user.objectiveProgress.map((op) => ({
          questId: op.questId,
          objectiveId: op.objectiveId,
          collected: op.collected,
        }))
      : undefined,
  };
}

export default async function QuestItemsPage() {
  let initialTasks: any[] | undefined;
  let initialUserProgress: InitialUserProgress = null;

  try {
    const tasks = await getTasksRef();
    if (Array.isArray(tasks) && tasks.length > 0) {
      initialTasks = tasks as any[];
    }
  } catch (error) {
    console.error("Failed to load quest items ref on server", error);
  }

  try {
    initialUserProgress = await getInitialUserProgress();
  } catch (error) {
    console.error("Failed to load quest items user progress on server", error);
  }

  return <QuestItemsClient initialTasks={initialTasks} initialUserProgress={initialUserProgress} />;
}
