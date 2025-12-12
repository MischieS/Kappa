import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserById } from "@/lib/repository/userRepository";
import { createTeam, getTeamsForUser } from "@/lib/repository/teamRepository";

export const runtime = "nodejs";

async function getCurrentUser() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("userId")?.value;
  if (!userId) return null;
  const user = await getUserById(userId);
  return user ?? null;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const teams = await getTeamsForUser(user.id);

  return NextResponse.json({ teams });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const name = (body?.name ?? "").toString().trim();

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  if (name.length > 80) {
    return NextResponse.json({ error: "name is too long" }, { status: 400 });
  }

  const { team, membership } = await createTeam(user.id, name);

  return NextResponse.json(
    {
      team,
      membership,
    },
    { status: 201 },
  );
}
