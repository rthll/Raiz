/**
 * Formatação e parsing de valores em pt-BR / BRL.
 * Espelha `money()`, `num()` e `pct()` do protótipo (design/Raiz Gestao Financeira.dc.html).
 */

export const PRIVACY_MASK = 'R$ ••••';

export interface FormatMoneyOptions {
  /** 0 para projeções e valores grandes, 2 (padrão) para o resto. */
  decimals?: 0 | 2;
  /** Quando ligado, mascara o valor — usado pelo `modoPrivacidade`. */
  privacy?: boolean;
}

/** `1234.5` → `"R$ 1.234,50"`. Com `privacy`, devolve a máscara. */
export function formatBRL(value: number | null | undefined, options: FormatMoneyOptions = {}): string {
  if (options.privacy) return PRIVACY_MASK;
  const decimals = options.decimals === 0 ? 0 : 2;
  const n = Number(value ?? 0);
  const safe = Number.isFinite(n) ? n : 0;
  return (
    'R$ ' +
    safe.toLocaleString('pt-BR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  );
}

/**
 * Lê um valor digitado em pt-BR: `"1.234,56"` → `1234.56`.
 * Aceita número puro, prefixo `R$`, espaços e sinal negativo. Nunca lança: devolve 0.
 */
export function parseBRL(input: unknown): number {
  if (typeof input === 'number') return Number.isFinite(input) ? input : 0;
  const raw = String(input ?? '');
  const negative = /-/.test(raw);
  const cleaned = raw
    .replace(/\./g, '')
    .replace(/,/g, '.')
    .replace(/[^0-9.]/g, '');
  const parsed = Number.parseFloat(cleaned);
  if (!Number.isFinite(parsed)) return 0;
  return negative ? -parsed : parsed;
}

/** `18.4` → `"18%"`; com `decimals: 1` → `"18,4%"`. Vírgula como separador decimal. */
export function formatPercent(value: number | null | undefined, decimals = 0): string {
  const n = Number(value ?? 0);
  const safe = Number.isFinite(n) ? n : 0;
  return safe.toFixed(decimals).replace('.', ',') + '%';
}

/** Assina o valor como o protótipo faz na tabela de lançamentos: `+ R$ …` / `– R$ …`. */
export function formatSignedBRL(
  value: number,
  kind: 'entrada' | 'saida',
  options: FormatMoneyOptions = {},
): string {
  return (kind === 'entrada' ? '+ ' : '– ') + formatBRL(value, options);
}
