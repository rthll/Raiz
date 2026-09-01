import type { HTMLAttributes, ReactNode } from 'react';

export type Elevacao = 'sm' | 'md' | 'lg';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  elevacao?: Elevacao;
  /** Substitui o fundo `--color-surface` por outro token. Aceita só `var(--…)`. */
  fundo?: string;
  /** Cor do texto quando o card é escuro. */
  cor?: string;
  children?: ReactNode;
}

/**
 * Card do Organic (`.card` = surface, gap e raio já definidos).
 *
 * `fundo`/`cor` existem porque o design usa cards tintados de propósito — o KPI
 * de patrimônio em `--color-accent-900`, o de reserva em `--color-accent-2-200`.
 * Devem receber **tokens**, nunca um hex.
 */
export function Card({ elevacao, fundo, cor, className, style, ...props }: CardProps) {
  const classes = ['card', elevacao ? `elev-${elevacao}` : '', className ?? '']
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={classes}
      style={{ ...(fundo ? { background: fundo } : {}), ...(cor ? { color: cor } : {}), ...style }}
      {...props}
    />
  );
}

export const CardKicker = ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className="card-kicker" {...props}>
    {children}
  </div>
);

export const CardTitle = ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className="card-title" {...props}>
    {children}
  </div>
);

export const CardBody = ({ children, ...props }: HTMLAttributes<HTMLParagraphElement>) => (
  <p className="card-body" {...props}>
    {children}
  </p>
);

export const CardMeta = ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className="card-meta" {...props}>
    {children}
  </div>
);
