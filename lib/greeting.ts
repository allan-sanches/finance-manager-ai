import { APP_TIME_ZONE } from '@/lib/finance';

const HOUR = new Intl.DateTimeFormat('pt-BR', { hour: 'numeric', hourCycle: 'h23', timeZone: APP_TIME_ZONE });

/** "Bom dia", "Boa tarde" ou "Boa noite" pelo horário de Brasília; com nome: "Bom dia, Allan". */
export function greeting(name?: string | null, now: Date = new Date()): string {
  const h = Number(HOUR.format(now));
  const base = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  const clean = name?.trim();
  return clean ? `${base}, ${clean}` : base;
}
