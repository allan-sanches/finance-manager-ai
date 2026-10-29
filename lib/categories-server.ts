import 'server-only';

import { getDb } from '@/lib/db';
import { listCategoryNames } from '@/lib/db/repository';
import { CATEGORIES } from '@/lib/finance';

/** Categorias para os prompts da IA. Se o banco falhar, a IA segue com as padrão em vez de quebrar. */
export async function userCategoryNames(): Promise<string[]> {
  try {
    return await listCategoryNames(getDb());
  } catch (err) {
    console.error('[categories] falha ao ler categorias do usuário', err);
    return [...CATEGORIES];
  }
}
