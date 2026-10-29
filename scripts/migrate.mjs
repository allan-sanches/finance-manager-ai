// Aplica as migrações SQL de ./drizzle. Roda como preDeployCommand na Railway,
// antes de cada deploy subir, e localmente com `npm run db:migrate`.
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('[migrate] DATABASE_URL não está definida.');
  process.exit(1);
}

const client = postgres(url, { max: 1 });
try {
  await migrate(drizzle({ client }), { migrationsFolder: './drizzle' });
  console.log('[migrate] migrações aplicadas.');
} catch (err) {
  console.error('[migrate] falhou:', err);
  process.exitCode = 1;
} finally {
  await client.end();
}
