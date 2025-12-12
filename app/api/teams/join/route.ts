import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserById } from "@/lib/repository/userRepository";
import { joinTeamByInviteCode } from "@/lib/repository/teamRepository";

export const runtime = "nodejs";

async function getCurrentUser() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("userId")?.value;
  if (!userId) return null;
  const user = await getUserById(userId);
  return user ?? null;
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const inviteCode = (body?.inviteCode ?? "").toString().trim();

  if (!inviteCode) {
    return NextResponse.json({ error: "inviteCode is required" }, { status: 400 });
  }

  const result = await joinTeamByInviteCode(user.id, inviteCode);

  if (!result) {
    return NextResponse.json({ error: "invalid invite code" }, { status: 404 });
  }

  return NextResponse.json({ team: result.team, membership: result.membership }, { status: 200 });
}
