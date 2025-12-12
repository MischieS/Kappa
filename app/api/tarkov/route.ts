import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const TARKOV_API_URL = 'https://api.tarkov.dev/graphql';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const query = body?.query as string | undefined;
  const variables = body?.variables as Record<string, unknown> | undefined;

  if (!query) {
    return NextResponse.json({ error: 'query is required' }, { status: 400 });
  }

  const response = await fetch(TARKOV_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  const data = await response.json();

  return NextResponse.json(data, { status: response.ok ? 200 : response.status });
}
