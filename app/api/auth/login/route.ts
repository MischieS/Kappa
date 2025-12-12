import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getUserByUsername } from '@/lib/repository/userRepository';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const username = body?.username as string | undefined;
  const password = body?.password as string | undefined;

  if (!username || !password) {
    return NextResponse.json({ error: 'username and password are required' }, { status: 400 });
  }

  const user = await getUserByUsername(username);
  if (!user) {
    return NextResponse.json({ error: 'invalid credentials' }, { status: 401 });
  }

  const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
  if (passwordHash !== user.passwordHash) {
    return NextResponse.json({ error: 'invalid credentials' }, { status: 401 });
  }

  const response = NextResponse.json({
    id: user.id,
    username: user.username,
    faction: user.faction,
    gameEdition: user.gameEdition,
  });
  response.cookies.set('userId', user.id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });

  return response;
}
