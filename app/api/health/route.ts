import { NextResponse } from 'next/server';

import { getDb } from '@/lib/db';
import { checkConnection } from '@/lib/db/repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Usado pelo healthcheck da Railway. Público no proxy; não expõe nada além de ok/erro. */
export async function GET() {
  try {
    await checkConnection(getDb());
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[health] database check failed', err);
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
