import 'server-only';

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from '@/lib/db/schema';
import type { Db } from '@/lib/db/repository';

// Conexão criada sob demanda: o `next build` não tem DATABASE_URL e não deve falhar por isso.
// O cache em globalThis evita abrir um pool novo a cada hot reload no dev.
const globalForDb = globalThis as unknown as { financeDb?: Db };

export function getDb(): Db {
  if (globalForDb.financeDb) return globalForDb.financeDb;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL não está definida.');
  const client = postgres(url, { max: 10 });
  globalForDb.financeDb = drizzle({ client, schema });
  return globalForDb.financeDb;
}
