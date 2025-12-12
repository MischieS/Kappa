import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { findUserById, saveUser, type HideoutItemProgress } from "@/lib/db";

export const runtime = "nodejs";

async function getCurrentUser() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("userId")?.value;
  if (!userId) return null;
  const user = await findUserById(userId);
  return user ?? null;
}

export async function GET(_request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    items: Array.isArray(user.hideoutItems) ? user.hideoutItems : [],
  });
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const rawItems = body?.items;

  if (!Array.isArray(rawItems)) {
    return NextResponse.json({ error: "items array is required" }, { status: 400 });
  }

  const sanitized: HideoutItemProgress[] = [];

  for (const raw of rawItems as any[]) {
    if (!raw || !raw.itemId) continue;

    const itemId = String(raw.itemId);
    const name = raw.name ? String(raw.name) : "Item";
    const shortName = raw.shortName ? String(raw.shortName) : undefined;
    const iconLink = raw.iconLink ? String(raw.iconLink) : undefined;
    const wikiLink = raw.wikiLink ? String(raw.wikiLink) : undefined;
    const requiresFir = Boolean(raw.requiresFir);

    const totalRequiredRaw = Number(raw.totalRequired ?? 0);
    const totalCollectedRaw = Number(raw.totalCollected ?? 0);

    if (!Number.isFinite(totalRequiredRaw) || totalRequiredRaw <= 0) {
      continue;
    }

    const totalRequired = Math.max(0, Math.floor(totalRequiredRaw));
    const totalCollected = Math.max(0, Math.min(totalRequired, Math.floor(totalCollectedRaw)));

    sanitized.push({
      itemId,
      name,
      shortName,
      iconLink,
      wikiLink,
      requiresFir,
      totalRequired,
      totalCollected,
    });
  }

  user.hideoutItems = sanitized;
  await saveUser(user);

  return NextResponse.json({ items: user.hideoutItems ?? [] });
}
