'use client';

import { useMemo } from 'react';

import { mergeCategoryNames } from '@/lib/finance';
import { useFinanceStore } from '@/lib/store';
import { categoryStyle, type CategoryStyle } from '@/lib/tones';

export function useCategories(): { names: string[]; styleOf: (name: string) => CategoryStyle } {
  const custom = useFinanceStore((s) => s.categories);
  return useMemo(
    () => ({
      names: mergeCategoryNames(custom),
      styleOf: (name: string) => categoryStyle(name, custom),
    }),
    [custom],
  );
}
