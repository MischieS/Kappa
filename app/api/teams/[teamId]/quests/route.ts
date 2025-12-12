import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserById } from "@/lib/repository/userRepository";
import { getTeamById, getMembersForTeam } from "@/lib/repository/teamRepository";
import type { GameEdition, QuestStatus } from "@/lib/types/quest";

export const runtime = "nodejs";

const TEAM_MEMBER_LIMIT = 5;

const TASKS_QUERY = `
  query TasksForTeamProgress {
    tasks {
      id
      name
      minPlayerLevel
      requiredPrestige {
        prestigeLevel
      }
      kappaRequired
      lightkeeperRequired
      trader {
        name
      }
      map {
        name
      }
      taskRequirements {
        task {
          id
          name
        }
        status
      }
    }
  }
`;

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

interface QuestMeta {
  id: string;
  title: string;
  previousQuestIds?: string[];
  levelRequirement?: number;
  editionRequirement?: GameEdition;
  requiredPrestige?: number;
}

async function getCurrentUser() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("userId")?.value;
  if (!userId) return null;
  const user = await getUserById(userId);
  return user ?? null;
}

function computeQuestStatusForUser(
  quest: QuestMeta,
  completedQuestIds: Set<string>,
  userLevel?: number,
  userFenceRep?: number,
  userEdition?: string,
): QuestStatus {
  if (completedQuestIds.has(quest.id)) {
    return "completed";
  }

  let locked = false;

  if (quest.previousQuestIds && quest.previousQuestIds.length > 0) {
    const missingPrev = quest.previousQuestIds.filter((id) => !completedQuestIds.has(id));
    if (missingPrev.length > 0) {
      locked = true;
    }
  }

  if (!locked && typeof quest.levelRequirement === "number" && typeof userLevel === "number") {
    if (!Number.isNaN(userLevel) && userLevel < quest.levelRequirement) {
      locked = true;
    }
  }

  if (!locked && typeof quest.requiredPrestige === "number" && typeof userFenceRep === "number") {
    const required = quest.requiredPrestige;
    const current = userFenceRep;
    const meetsPrestige = required >= 0 ? current >= required : current <= required;
    if (!meetsPrestige) {
      locked = true;
    }
  }

  if (!locked && quest.editionRequirement && typeof userEdition === "string" && userEdition) {
    const requiredEdition = quest.editionRequirement;
    let meetsEdition = false;

    if (requiredEdition === "Edge of Darkness") {
      if (userEdition === "Edge of Darkness" || userEdition === "Unheard") {
        meetsEdition = true;
      }
    } else {
      meetsEdition = userEdition === requiredEdition;
    }

    if (!meetsEdition) {
      locked = true;
    }
  }

  if (locked) return "locked";
  return "available";
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ teamId: string }> },
) {
  const { teamId } = await context.params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!teamId) {
    return NextResponse.json({ error: "teamId is required" }, { status: 400 });
  }

  const team = await getTeamById(teamId);
  if (!team) {
    return NextResponse.json({ error: "team not found" }, { status: 404 });
  }

  const memberships = await getMembersForTeam(team.id);
  const isMember = memberships.some((membership) => membership.userId === user.id);
  if (!isMember) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const limitedMemberships = memberships.slice(0, TEAM_MEMBER_LIMIT);

  const memberUsers = await Promise.all(
    limitedMemberships.map(async (membership) => {
      const memberUser = await getUserById(membership.userId);
      return { membership, user: memberUser };
    }),
  );

  const activeMembers = memberUsers.filter((entry) => entry.user != null);
  if (activeMembers.length === 0) {
    return NextResponse.json({ teamId: team.id, members: [] });
  }

  let rawTasks: any[] | null = null;

  try {
    const response = await fetch("https://api.tarkov.dev/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: TASKS_QUERY }),
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

  const questMetaList: QuestMeta[] = (rawTasks ?? []).map((task: any) => {
    const title = String(task?.name ?? "Unknown task");

    const previousQuestIds: string[] = Array.isArray(task.taskRequirements)
      ? task.taskRequirements
          .map((req: any) => req?.task?.id)
          .filter((id: unknown): id is string => typeof id === "string")
      : [];

    const levelRequirement =
      typeof task.minPlayerLevel === "number" && !Number.isNaN(task.minPlayerLevel)
        ? task.minPlayerLevel
        : undefined;

    const editionRequirement = getEditionRequirementForTask(title);

    let requiredPrestige: number | undefined =
      task.requiredPrestige &&
      typeof task.requiredPrestige.prestigeLevel === "number" &&
      !Number.isNaN(task.requiredPrestige.prestigeLevel)
        ? task.requiredPrestige.prestigeLevel
        : undefined;

    const overriddenPrestige = getFencePrestigeOverrideForTask(title);
    if (typeof overriddenPrestige === "number") {
      requiredPrestige = overriddenPrestige;
    }

    const quest: QuestMeta = {
      id: String(task.id),
      title,
      previousQuestIds: previousQuestIds.length > 0 ? previousQuestIds : undefined,
      levelRequirement,
      editionRequirement,
      requiredPrestige,
    };

    return quest;
  });

  const members = activeMembers.map(({ membership, user: memberUser }) => {
    const userLevel =
      typeof memberUser!.level === "number" && !Number.isNaN(memberUser!.level)
        ? memberUser!.level
        : undefined;
    const userFenceRep =
      typeof memberUser!.fenceRep === "number" && !Number.isNaN(memberUser!.fenceRep)
        ? memberUser!.fenceRep
        : undefined;
    const userEdition = memberUser!.gameEdition as string | undefined;

    const completedQuestIds = new Set<string>();

    if (Array.isArray(memberUser!.quests)) {
      for (const qp of memberUser!.quests) {
        if (!qp || !qp.questId) continue;
        if (qp.status === "completed") {
          completedQuestIds.add(String(qp.questId));
        }
      }
    }

    const quests = questMetaList.map((quest) => {
      const status = computeQuestStatusForUser(
        quest,
        completedQuestIds,
        userLevel,
        userFenceRep,
        userEdition,
      );

      return {
        questId: quest.id,
        status,
      };
    });

    return {
      userId: memberUser!.id,
      username: memberUser!.username ?? null,
      role: membership.role,
      quests,
    };
  });

  return NextResponse.json({
    teamId: team.id,
    members,
  });
}
