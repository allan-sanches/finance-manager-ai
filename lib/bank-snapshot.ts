import 'server-only';

import { accrueSnapshot } from '@/lib/accrual';
import type { Db } from '@/lib/db/repository';
import { getSnapshot } from '@/lib/db/repository';
import { todayISO } from '@/lib/finance';
import { getCdiAnnualRate } from '@/lib/marx/quotes';
import type { FinanceSnapshot } from '@/types/finance';

/**
 * Snapshot como o banco mostra hoje: CDB dos cartões e caixinhas que rendem % do CDI já com o
 * rendimento até ontem. Sem CDI (Banco Central fora do ar), volta o último valor conferido.
 */
export async function getBankSnapshot(db: Db, userId: string): Promise<FinanceSnapshot> {
  const [snapshot, cdi] = await Promise.all([getSnapshot(db, userId), getCdiAnnualRate()]);
  return accrueSnapshot(snapshot, cdi, todayISO());
}
