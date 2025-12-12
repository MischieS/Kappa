import { NextRequest, NextResponse } from 'next/server';
import { getHideoutStationsRef } from '@/lib/server/tarkovClient';

export const runtime = 'nodejs';

export async function GET(_request: NextRequest) {
  try {
    const stations = await getHideoutStationsRef();
    return NextResponse.json({ stations });
  } catch (error) {
    console.error('Failed to load hideout stations ref', error);
    return NextResponse.json({ error: 'Failed to load hideout stations reference data' }, { status: 502 });
  }
}
