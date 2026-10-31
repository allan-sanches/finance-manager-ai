import 'server-only';

import { getSessionUserId } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { listCategoryNames } from '@/lib/db/repository';
import { CATEGORIES } from '@/lib/finance';

/** Categorias do usuário logado para os prompts da IA. Se o banco falhar, a IA segue com as padrão em vez de quebrar. */
export async function userCategoryNames(): Promise<string[]> {
  try {
    const userId = await getSessionUserId();
    if (!userId) return [...CATEGORIES];
    return await listCategoryNames(getDb(), userId);
  } catch (err) {
    console.error('[categories] falha ao ler categorias do usuário', err);
    return [...CATEGORIES];
  }
}
