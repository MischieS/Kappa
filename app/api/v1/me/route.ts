import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getUserById } from '@/lib/repository/userRepository';

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
  });
}
