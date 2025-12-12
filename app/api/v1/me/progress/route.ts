import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  getUserById,
  saveUser,
  type QuestProgress,
  type ItemProgress,
  type QuestObjectiveProgress,
  type TraderStanding,
} from '@/lib/repository/userRepository';

export const runtime = 'nodejs';

async function getCurrentUser() {
  const cookieStore = await cookies();
  const userId = cookieStore.get('userId')?.value;
  if (!userId) return null;
  const user = await getUserById(userId);
  return user ?? null;
}

export async function GET(_request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    id: user.id,
    username: user.username,
    faction: user.faction,
    gameEdition: user.gameEdition,
    level: user.level,
    fenceRep: user.fenceRep,
    quests: user.quests,
    items: user.items,
    objectives: user.objectiveProgress,
    traderStandings: user.traderStandings ?? [],
  });
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const quests = body?.quests as QuestProgress[] | undefined;
  const items = body?.items as ItemProgress[] | undefined;
  const objectives = body?.objectives as QuestObjectiveProgress[] | undefined;
  const traderStandings = body?.traderStandings as TraderStanding[] | undefined;
  const faction = body?.faction as string | undefined;
  const gameEdition = body?.gameEdition as string | undefined;
  const level = body?.level as number | undefined;
  const fenceRep = body?.fenceRep as number | undefined;

  if (
    !quests &&
    !items &&
    !objectives &&
    !traderStandings &&
    faction === undefined &&
    gameEdition === undefined &&
    level === undefined &&
    fenceRep === undefined
  ) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
  }

  if (faction !== undefined) {
    user.faction = faction;
  }

  if (gameEdition !== undefined) {
    user.gameEdition = gameEdition;
  }

  if (typeof level === 'number' && !Number.isNaN(level)) {
    user.level = level;
  }

  if (typeof fenceRep === 'number' && !Number.isNaN(fenceRep)) {
    user.fenceRep = fenceRep;
  }

  if (quests) {
    for (const incoming of quests) {
      const existing = user.quests.find((q) => q.questId === incoming.questId);
      if (existing) {
        existing.status = incoming.status;
        existing.completedAt = incoming.completedAt;
      } else {
        user.quests.push(incoming);
      }
    }
  }

  if (traderStandings) {
    if (!user.traderStandings) {
      user.traderStandings = [];
    }

    for (const incoming of traderStandings) {
      const existing = user.traderStandings.find((entry) => entry.traderId === incoming.traderId);
      if (existing) {
        existing.level = incoming.level;
      } else {
        user.traderStandings.push({
          traderId: incoming.traderId,
          level: incoming.level,
        });
      }
    }
  }

  if (objectives) {
    if (!user.objectiveProgress) {
      user.objectiveProgress = [];
    }

    for (const incoming of objectives) {
      const existing = user.objectiveProgress.find(
        (entry) => entry.questId === incoming.questId && entry.objectiveId === incoming.objectiveId,
      );

      if (existing) {
        existing.collected = incoming.collected;
      } else {
        user.objectiveProgress.push({
          questId: incoming.questId,
          objectiveId: incoming.objectiveId,
          collected: incoming.collected,
        });
      }
    }
  }

  if (items) {
    for (const incoming of items) {
      const existing = user.items.find((i) => i.itemId === incoming.itemId);
      if (existing) {
        existing.count = incoming.count;
      } else {
        user.items.push(incoming);
      }
    }
  }

  await saveUser(user);

  return NextResponse.json({
    id: user.id,
    username: user.username,
    quests: user.quests,
    items: user.items,
    objectives: user.objectiveProgress,
    traderStandings: user.traderStandings ?? [],
  });
}
