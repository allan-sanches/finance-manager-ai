import 'server-only';

import type { Db } from '@/lib/db/repository';
import * as repo from '@/lib/db/repository';
import { todayISO } from '@/lib/finance';
import { fetchProductInfo, ProductFetchError } from '@/lib/product-fetch';

/** Cada desejo com link é lido de novo depois desse intervalo (a rotina roda a cada 6h). */
export const PRICE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const CONCURRENCY = 3;

/** Lê o preço de cada desejo na página da loja e grava o ponto do dia. Devolve quantos deram certo. */
export async function checkWishPrices(db: Db, wishes: ReadonlyArray<repo.WishToCheck>): Promise<number> {
  let ok = 0;
  const queue = [...wishes];
  async function worker() {
    for (let wish = queue.shift(); wish; wish = queue.shift()) {
      const now = new Date();
      let result: repo.PriceCheckResult;
      try {
        const info = await fetchProductInfo(wish.productUrl);
        result = { ok: true, price: info.price, imageUrl: info.imageUrl };
        if (info.price !== null) ok += 1;
      } catch (err) {
        result = {
          ok: false,
          error: err instanceof ProductFetchError ? err.message : 'Não foi possível ler o preço.',
        };
      }
      try {
        await repo.recordPriceCheck(db, wish.userId, wish.id, result, { date: todayISO(now), now });
      } catch (err) {
        console.error('[price-watch] falha ao gravar leitura', wish.id, err);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
  return ok;
}
