import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { findUserById } from "@/lib/db";

export const runtime = "nodejs";

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
