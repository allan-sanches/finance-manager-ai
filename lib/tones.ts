// Blocos coloridos (tiles, avatares de categoria). A paleta é a mesma no tema claro e no escuro:
// as cores vivas são a identidade do app, e o texto de cada bloco já vem com contraste garantido.

export type Tone =
  | 'lime'
  | 'emerald'
  | 'mint'
  | 'cyan'
  | 'sky'
  | 'electric'
  | 'violet'
  | 'lavender'
  | 'pink'
  | 'coral'
  | 'red'
  | 'orange'
  | 'amber'
  | 'yellow'
  | 'slate'
  | 'graphite';

export const TONE_CLASS: Record<Tone, string> = {
  lime: 'bg-lime-300 text-neutral-900',
  emerald: 'bg-emerald-400 text-neutral-900',
  mint: 'bg-emerald-200 text-neutral-900',
  cyan: 'bg-cyan-300 text-neutral-900',
  sky: 'bg-sky-300 text-neutral-900',
  electric: 'bg-blue-600 text-white',
  violet: 'bg-violet-500 text-white',
  lavender: 'bg-indigo-300 text-neutral-900',
  pink: 'bg-pink-500 text-white',
  coral: 'bg-rose-300 text-neutral-900',
  red: 'bg-red-500 text-white',
  orange: 'bg-orange-400 text-neutral-900',
  amber: 'bg-amber-300 text-neutral-900',
  yellow: 'bg-yellow-200 text-neutral-900',
  slate: 'bg-slate-200 text-neutral-900',
  graphite: 'bg-neutral-800 text-lime-300',
};

/** Cor sólida do tom, para gráficos (Recharts não lê classes). */
export const TONE_HEX: Record<Tone, string> = {
  lime: '#bef264',
  emerald: '#34d399',
  mint: '#a7f3d0',
  cyan: '#67e8f9',
  sky: '#7dd3fc',
  electric: '#2563eb',
  violet: '#8b5cf6',
  lavender: '#a5b4fc',
  pink: '#ec4899',
  coral: '#fda4af',
  red: '#ef4444',
  orange: '#fb923c',
  amber: '#fcd34d',
  yellow: '#fef08a',
  slate: '#e2e8f0',
  graphite: '#262626',
};

export type CategoryStyle = { emoji: string; tone: Tone };

const CATEGORY_STYLE: Record<string, CategoryStyle> = {
  alimentacao: { emoji: '🍔', tone: 'orange' },
  moradia: { emoji: '🏠', tone: 'violet' },
  transporte: { emoji: '🚗', tone: 'sky' },
  lazer: { emoji: '🎉', tone: 'pink' },
  saude: { emoji: '💊', tone: 'coral' },
  educacao: { emoji: '📚', tone: 'lavender' },
  salario: { emoji: '💰', tone: 'emerald' },
  investimentos: { emoji: '📈', tone: 'lime' },
  assinaturas: { emoji: '📺', tone: 'electric' },
  dividas: { emoji: '💳', tone: 'red' },
  outros: { emoji: '🏷️', tone: 'slate' },
};

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

/** Categorias livres (vindas da IA ou digitadas) que não estão no mapa caem em "Outros". */
export function categoryStyle(category: string): CategoryStyle {
  const key = normalize(category);
  if (key.startsWith('divida')) return CATEGORY_STYLE.dividas;
  return CATEGORY_STYLE[key] ?? CATEGORY_STYLE.outros;
}
