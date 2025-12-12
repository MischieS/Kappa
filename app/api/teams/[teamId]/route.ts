import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { findTeamById, getTeamMembers, findUserById } from "@/lib/db";

export const runtime = "nodejs";

async function getCurrentUser() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("userId")?.value;
  if (!userId) return null;
  const user = await findUserById(userId);
  return user ?? null;
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

  const membersWithUser = await Promise.all(
    memberships.map(async (membership) => {
      const memberUser = await findUserById(membership.userId);
      return {
        id: membership.id,
        teamId: membership.teamId,
        userId: membership.userId,
        role: membership.role,
        joinedAt: membership.joinedAt,
        username: memberUser?.username ?? null,
        isOwner: membership.userId === team.ownerUserId,
      };
    }),
  );

  const isOwner = team.ownerUserId === user.id;

  return NextResponse.json({
    team: {
      id: team.id,
      name: team.name,
      ownerUserId: team.ownerUserId,
      inviteCode: isOwner ? team.inviteCode : undefined,
      createdAt: team.createdAt,
    },
    memberships: membersWithUser,
  });
}
