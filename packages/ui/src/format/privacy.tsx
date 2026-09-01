import { formatBRL, formatPercent, type FormatMoneyOptions } from '@raiz/core';
import { createContext, useContext, useMemo, type ReactNode } from 'react';

/**
 * Modo privacidade.
 *
 * Quando ligado, todo valor em dinheiro vira `R$ ••••`. A máscara é aplicada na
 * formatação, não no dado: o componente que exibe nunca precisa saber se está
 * mascarado, e nenhuma tela pode esquecer de mascarar por conta própria.
 */
const PrivacyContext = createContext(false);

export function PrivacyProvider({
  ativo,
  children,
}: {
  ativo: boolean;
  children: ReactNode;
}) {
  return <PrivacyContext.Provider value={ativo}>{children}</PrivacyContext.Provider>;
}

export function usePrivacidade(): boolean {
  return useContext(PrivacyContext);
}

/**
 * Formatador de dinheiro já ciente do modo privacidade.
 * Use sempre este, nunca `formatBRL` direto numa tela.
 */
export function useMoney() {
  const privacy = usePrivacidade();
  return useMemo(
    () => (valor: number | null | undefined, options: Omit<FormatMoneyOptions, 'privacy'> = {}) =>
      formatBRL(valor, { ...options, privacy }),
    [privacy],
  );
}

export interface MoneyProps {
  valor: number | null | undefined;
  /** 0 para projeções e valores grandes; 2 é o padrão. */
  decimals?: 0 | 2;
  /** Prefixa `+ ` ou `– `, como na tabela de lançamentos. */
  sinal?: 'ENTRADA' | 'SAIDA';
  className?: string;
  style?: React.CSSProperties;
}

/** Um valor em reais. Respeita o modo privacidade automaticamente. */
export function Money({ valor, decimals, sinal, className, style }: MoneyProps) {
  const money = useMoney();
  const texto = money(valor, decimals === 0 ? { decimals: 0 } : {});
  const prefixo = sinal === 'ENTRADA' ? '+ ' : sinal === 'SAIDA' ? '– ' : '';
  return (
    <span className={className} style={style}>
      {prefixo}
      {texto}
    </span>
  );
}

/** Percentuais não são mascarados — não revelam quanto se ganha ou se gasta. */
export function Percent({ valor, decimals = 0 }: { valor: number; decimals?: number }) {
  return <>{formatPercent(valor, decimals)}</>;
}
