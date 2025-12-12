import { NextRequest, NextResponse } from 'next/server';
import { getTasksRef } from '@/lib/server/tarkovClient';

export const runtime = 'nodejs';

export async function GET(_request: NextRequest) {
  try {
    const tasks = await getTasksRef();
    return NextResponse.json({ tasks });
  } catch (error) {
    console.error('Failed to load tasks ref', error);
    return NextResponse.json({ error: 'Failed to load tasks reference data' }, { status: 502 });
  }
}
