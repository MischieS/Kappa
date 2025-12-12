import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { findTeamById, getTeamMembers, findUserById } from "@/lib/db";

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

export const runtime = "nodejs";

async function getCurrentUser() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("userId")?.value;
  if (!userId) return null;
  const user = await findUserById(userId);
  return user ?? null;
}

interface MemberTotals {
  required: number;
  collected: number;
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

  const team = await findTeamById(teamId);
  if (!team) {
    return NextResponse.json({ error: "team not found" }, { status: 404 });
  }

  const memberships = await getTeamMembers(team.id);
  const isMember = memberships.some((membership) => membership.userId === user.id);
  if (!isMember) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const memberUsers = await Promise.all(
    memberships.map(async (membership) => {
      const memberUser = await findUserById(membership.userId);
      return {
        membership,
        user: memberUser,
      };
    }),
  );

  const activeMembers = memberUsers.filter((entry) => entry.user != null);
  if (activeMembers.length === 0) {
    return NextResponse.json({ teamId: team.id, items: [] });
  }

  let rawTasks: any[] | null = null;

  try {
    const response = await fetch("https://api.tarkov.dev/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: TASK_ITEMS_QUERY }),
      next: { revalidate: 60 * 60 },
    });

    const result = await response.json().catch(() => null);

    if (response.ok && result && result.data && Array.isArray(result.data.tasks)) {
      rawTasks = result.data.tasks as any[];
    }
  } catch {
  }

  if (!rawTasks) {
    return NextResponse.json({ error: "failed to load tasks from tarkov.dev" }, { status: 502 });
  }

  const teamItems = new Map<
    string,
    {
      itemId: string;
      name: string;
      shortName?: string;
      iconLink?: string;
      wikiLink?: string;
      requiresFir: boolean;
      totalRequired: number;
      totalCollected: number;
      perMember: Map<string, MemberTotals>;
    }
  >();

  for (const { membership, user: memberUser } of activeMembers) {
    if (!memberUser) continue;

    const statusByQuestId = new Map<string, string>();
    if (Array.isArray(memberUser.quests)) {
      for (const qp of memberUser.quests) {
        if (!qp || !qp.questId) continue;
        statusByQuestId.set(String(qp.questId), String(qp.status));
      }
    }

    const objectiveProgressByKey = new Map<string, number>();
    if (Array.isArray(memberUser.objectiveProgress)) {
      for (const op of memberUser.objectiveProgress) {
        if (!op || !op.questId || !op.objectiveId) continue;
        const key = `${String(op.questId)}:${String(op.objectiveId)}`;
        const value = Number(op.collected ?? 0);
        objectiveProgressByKey.set(key, Number.isNaN(value) ? 0 : value);
      }
    }

    for (const task of rawTasks as any[]) {
      if (!task || !task.id) continue;
      const questId = String(task.id);
      const questStatusRaw = statusByQuestId.get(questId);
      const questCompleted = questStatusRaw === "completed";

      if (!Array.isArray(task.objectives)) continue;

      for (const objective of task.objectives as any[]) {
        if (!objective || !Array.isArray(objective.items) || objective.items.length !== 1) continue;
        if (!objective.id) continue;

        const objectiveId = String(objective.id);
        const key = `${questId}:${objectiveId}`;

        const baseRequired =
          typeof objective.count === "number" && !Number.isNaN(objective.count) && objective.count > 0
            ? objective.count
            : 1;

        const description =
          typeof objective.description === "string" ? objective.description.toLowerCase() : "";

        let collectedRaw = objectiveProgressByKey.get(key) ?? 0;

        if (questCompleted) {
          collectedRaw = baseRequired;
        }

        const collectedUnits = Math.max(0, Math.min(baseRequired, collectedRaw));

        for (const it of objective.items as any[]) {
          if (!it || typeof it !== "object") continue;

          const itemId = String(it.id ?? `${objectiveId}-item`);
          const baseName = String(it.name ?? "Item");
          const shortName = it.shortName ? String(it.shortName) : undefined;
          const iconLink = it.iconLink ? String(it.iconLink) : undefined;
          const wikiLink = it.wikiLink ? String(it.wikiLink) : undefined;

          if (description) {
            const baseLower = baseName.toLowerCase();
            const shortLower = shortName ? shortName.toLowerCase() : "";
            if (!description.includes(baseLower) && (!shortLower || !description.includes(shortLower))) {
              continue;
            }
          }

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

          const requiredUnits = isMoney ? 1 : baseRequired;
          const collectedForItem = isMoney
            ? collectedRaw >= baseRequired
              ? 1
              : 0
            : collectedUnits;

          const requiresFir = Boolean(objective.foundInRaid);

          let entry = teamItems.get(itemId);
          if (!entry) {
            entry = {
              itemId,
              name: baseName,
              shortName,
              iconLink,
              wikiLink,
              requiresFir,
              totalRequired: 0,
              totalCollected: 0,
              perMember: new Map<string, MemberTotals>(),
            };
            teamItems.set(itemId, entry);
          }

          entry.totalRequired += requiredUnits;
          entry.totalCollected += collectedForItem;

          const memberKey = membership.userId;
          const prev = entry.perMember.get(memberKey) ?? { required: 0, collected: 0 };
          prev.required += requiredUnits;
          prev.collected += collectedForItem;
          entry.perMember.set(memberKey, prev);

          if (requiresFir) {
            entry.requiresFir = true;
          }
        }
      }
    }

    if (Array.isArray(memberUser.hideoutItems)) {
      for (const hideoutItem of memberUser.hideoutItems) {
        if (!hideoutItem || !hideoutItem.itemId) continue;

        const itemId = String(hideoutItem.itemId);
        const name = hideoutItem.name ? String(hideoutItem.name) : "Item";
        const shortName = hideoutItem.shortName ? String(hideoutItem.shortName) : undefined;
        const iconLink = hideoutItem.iconLink ? String(hideoutItem.iconLink) : undefined;
        const wikiLink = hideoutItem.wikiLink ? String(hideoutItem.wikiLink) : undefined;
        const requiresFir = Boolean(hideoutItem.requiresFir);

        const totalRequiredRaw = Number(hideoutItem.totalRequired ?? 0);
        const totalCollectedRaw = Number(hideoutItem.totalCollected ?? 0);

        if (!Number.isFinite(totalRequiredRaw) || totalRequiredRaw <= 0) {
          continue;
        }

        const totalRequired = Math.max(0, Math.floor(totalRequiredRaw));
        const totalCollected = Math.max(0, Math.min(totalRequired, Math.floor(totalCollectedRaw)));

        let entry = teamItems.get(itemId);
        if (!entry) {
          entry = {
            itemId,
            name,
            shortName,
            iconLink,
            wikiLink,
            requiresFir,
            totalRequired: 0,
            totalCollected: 0,
            perMember: new Map<string, MemberTotals>(),
          };
          teamItems.set(itemId, entry);
        }

        entry.totalRequired += totalRequired;
        entry.totalCollected += totalCollected;

        const memberKey = membership.userId;
        const prev = entry.perMember.get(memberKey) ?? { required: 0, collected: 0 };
        prev.required += totalRequired;
        prev.collected += totalCollected;
        entry.perMember.set(memberKey, prev);

        if (requiresFir) {
          entry.requiresFir = true;
        }
      }
    }
  }

  const items = Array.from(teamItems.values()).map((entry) => {
    const members = Array.from(entry.perMember.entries()).map(([memberUserId, totals]) => {
      const membership = memberships.find((m) => m.userId === memberUserId);
      const memberUser = activeMembers.find((m) => m.user?.id === memberUserId)?.user ?? null;

      return {
        userId: memberUserId,
        username: memberUser?.username ?? null,
        required: totals.required,
        collected: totals.collected,
        role: membership?.role ?? null,
      };
    });

    return {
      itemId: entry.itemId,
      name: entry.name,
      shortName: entry.shortName,
      iconLink: entry.iconLink,
      wikiLink: entry.wikiLink,
      requiresFir: entry.requiresFir,
      totalRequired: entry.totalRequired,
      totalCollected: entry.totalCollected,
      members,
    };
  });

  items.sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({ teamId: team.id, items });
}
