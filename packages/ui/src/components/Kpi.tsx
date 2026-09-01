import type { ReactNode } from 'react';
import { Card } from './Card.js';
import { Money } from '../format/privacy.js';

export interface KpiProps {
  rotulo: string;
  valor: number;
  decimals?: 0 | 2;
  /** Linha de apoio: "3 contas conectadas", "2 salários + 1 freela". */
  nota?: ReactNode;
  /** Cor do valor. Entradas em sálvia, saídas em terracota. */
  corValor?: string;
  /** Card tintado: o de patrimônio é escuro, o de reserva é sálvia clara. */
  fundo?: string;
  cor?: string;
}

/**
 * Cartão de indicador. Valor em Caprasimo 27px, como o design especifica.
 *
 * O valor passa por `Money`, então o modo privacidade o mascara sem que a tela
 * precise se lembrar disso.
 */
export function Kpi({ rotulo, valor, decimals, nota, corValor, fundo, cor }: KpiProps) {
  return (
    <Card fundo={fundo} cor={cor}>
      <div style={{ fontSize: 12, color: cor ?? 'var(--color-neutral-700)' }}>{rotulo}</div>
      <Money
        valor={valor}
        decimals={decimals}
        style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 27,
          lineHeight: 1.1,
          color: corValor,
          // Números longos não podem estourar a largura do card.
          overflowWrap: 'anywhere',
        }}
      />
      {nota && <div style={{ fontSize: 12, opacity: 0.8 }}>{nota}</div>}
    </Card>
  );
}
