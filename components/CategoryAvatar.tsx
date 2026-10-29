'use client';

import { TONE_CLASS } from '@/lib/tones';
import { useCategories } from '@/lib/useCategories';

/** Quadradinho colorido com o emoji da categoria (padrão ou criada pelo usuário). */
export function CategoryAvatar({ category, size = 'md' }: { category: string; size?: 'sm' | 'md' }) {
  const { styleOf } = useCategories();
  const { emoji, tone } = styleOf(category);
  const box = size === 'sm' ? 'h-9 w-9 text-lg' : 'h-11 w-11 text-xl';
  return (
    <span aria-hidden className={`grid shrink-0 place-items-center rounded-xl ${box} ${TONE_CLASS[tone]}`}>
      {emoji}
    </span>
  );
}
