import { createStore } from 'zustand/vanilla';

// Modo privado (o "olho" dos apps de banco): com ele ligado, todo valor formatado vira "R$ ••••".
// Fica no aparelho (localStorage), não na conta: cada celular escolhe o seu.
// No servidor o estado é sempre "visível"; os valores só aparecem depois que o app hidrata no
// navegador, e a preferência é lida antes disso (ver PrivacyGate), então nada vaza no carregamento.

export const PRIVACY_STORAGE_KEY = 'finance-privacy';
const MASK = '••••';

export const privacyStore = createStore<{ hidden: boolean }>(() => ({ hidden: false }));

export const isPrivate = () => privacyStore.getState().hidden;

export function setPrivate(hidden: boolean) {
  privacyStore.setState({ hidden });
  try {
    if (hidden) localStorage.setItem(PRIVACY_STORAGE_KEY, '1');
    else localStorage.removeItem(PRIVACY_STORAGE_KEY);
  } catch {
    // localStorage indisponível: vale só para esta aba.
  }
}

export function readSavedPrivacy(): boolean {
  try {
    return localStorage.getItem(PRIVACY_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export type MoneyFormat = { format: (value: number) => string };

/** Formatador de moeda que respeita o modo privado. `symbol` aparece na máscara ("R$ ••••"). */
export function moneyFormat(options: Intl.NumberFormatOptions, symbol: string): MoneyFormat {
  const fmt = new Intl.NumberFormat('pt-BR', options);
  return { format: (value) => (isPrivate() ? `${symbol} ${MASK}` : fmt.format(value)) };
}
