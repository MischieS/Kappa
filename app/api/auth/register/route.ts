import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createUser, getUserByUsername } from '@/lib/repository/userRepository';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const username = body?.username as string | undefined;
  const password = body?.password as string | undefined;
  const faction = body?.faction as string | undefined;
  const gameEdition = body?.gameEdition as string | undefined;

  if (!username || !password) {
    return NextResponse.json({ error: 'username and password are required' }, { status: 400 });
  }

  const existing = await getUserByUsername(username);
  if (existing) {
    return NextResponse.json({ error: 'username already taken' }, { status: 400 });
  }

  const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
  const user = await createUser(username, passwordHash, faction, gameEdition);

  return NextResponse.json(
    { id: user.id, username: user.username, faction: user.faction, gameEdition: user.gameEdition },
    { status: 201 },
  );
}
