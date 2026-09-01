import type { HTMLAttributes, ReactNode } from 'react';

export type TagVariant = 'accent' | 'accent-2' | 'neutral' | 'outline';

export interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: TagVariant;
  children: ReactNode;
}

/** Etiqueta do Organic. `recorrente`, `Ativa`, `Pausada`, `Atenção`. */
export function Tag({ variant = 'neutral', className, ...props }: TagProps) {
  return <span className={['tag', `tag-${variant}`, className ?? ''].join(' ').trim()} {...props} />;
}

/**
 * Chip de percentual dos cards de categoria e das metas.
 *
 * Sálvia no caso normal, terracota quando estoura — a mesma inversão que a barra
 * faz, para a informação não depender só da cor da barra.
 */
export function ChipPercentual({ pct, estourou }: { pct: string; estourou?: boolean }) {
  return (
    <span
      className="tag"
      style={{
        whiteSpace: 'nowrap',
        background: estourou ? 'var(--color-accent-200)' : 'var(--color-accent-2-100)',
        color: estourou ? 'var(--color-accent-800)' : 'var(--color-accent-2-800)',
      }}
    >
      {pct}
    </span>
  );
}
