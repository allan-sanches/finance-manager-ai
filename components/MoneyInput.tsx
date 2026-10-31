'use client';

import type { InputHTMLAttributes } from 'react';

import { maskMoney } from '@/lib/money-mask';
import type { Currency } from '@/types/finance';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'inputMode'> & {
  value: string;
  onChange: (masked: string) => void;
  currency?: Currency;
  /** Classes extras do contorno (ex.: "input-sm"). */
  wrapperClassName?: string;
};

const SYMBOL: Record<Currency, string> = { BRL: 'R$', USD: 'US$' };

/** Campo de valor com máscara "2.000,00" e prefixo da moeda. Use parseMoneyInput para ler o número. */
export function MoneyInput({ value, onChange, currency = 'BRL', wrapperClassName = '', placeholder = '0,00', ...rest }: Props) {
  return (
    <div className={`input input-bordered w-full ${wrapperClassName}`}>
      <span className="text-base-content/60 text-sm font-semibold">{SYMBOL[currency]}</span>
      <input
        {...rest}
        className="grow tabular-nums"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(maskMoney(e.target.value))}
      />
    </div>
  );
}
