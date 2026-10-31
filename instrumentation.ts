// Roda uma vez quando o servidor sobe. Agenda a leitura automática dos preços da lista de desejos:
// chama a própria rota /api/cron/prices a cada 6h (o banco tem `server-only`, que não pode ser
// importado aqui). Fica desligada no `next dev`; PRICE_WATCH=off desliga também em produção.

const FIRST_RUN_MS = 2 * 60 * 1000;
const EVERY_MS = 6 * 60 * 60 * 1000;

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NODE_ENV !== 'production' || process.env.PRICE_WATCH === 'off') return;

  const { priceWatchSecret } = await import('./lib/price-watch-secret');
  const secret = priceWatchSecret();
  if (!secret) return;

  const url = `http://127.0.0.1:${process.env.PORT ?? 3000}/api/cron/prices`;
  const run = async () => {
    try {
      const res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${secret}` } });
      if (!res.ok) console.error('[price-watch] rotina respondeu', res.status);
    } catch (err) {
      console.error('[price-watch] rotina falhou', err);
    }
  };
  setTimeout(run, FIRST_RUN_MS).unref();
  setInterval(run, EVERY_MS).unref();
}
