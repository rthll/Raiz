/**
 * Ponte tipada para os tokens do Organic.
 *
 * Nada aqui declara um valor — cada constante é só o *nome* de uma variável CSS
 * definida em `organic/styles.css`. Assim o TS autocompleta e erra cedo quando um
 * token não existe, sem duplicar a paleta em JS (o que faria os dois divergirem).
 */

export const color = {
  bg: 'var(--color-bg)',
  surface: 'var(--color-surface)',
  text: 'var(--color-text)',
  accent: 'var(--color-accent)',
  accent2: 'var(--color-accent-2)',
  divider: 'var(--color-divider)',
} as const;

type Step = 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;

export const neutral = (step: Step) => `var(--color-neutral-${step})`;
export const accent = (step: Step) => `var(--color-accent-${step})`;
export const accent2 = (step: Step) => `var(--color-accent-2-${step})`;

/** Escala 4.4 · 8.8 · 13.2 · 17.6 · 26.4 · 35.2px. */
export const space = (step: 1 | 2 | 3 | 4 | 6 | 8) => `var(--space-${step})`;

export const radius = {
  sm: 'var(--radius-sm)',
  md: 'var(--radius-md)',
  lg: 'var(--radius-lg)',
  /** Cards e diálogos. */
  container: 'calc(var(--radius-lg) * 1.15)',
  /** Botões, tags, inputs e o segmented control. */
  pill: '999px',
} as const;

export const shadow = {
  sm: 'var(--shadow-sm)',
  md: 'var(--shadow-md)',
  lg: 'var(--shadow-lg)',
} as const;

export const font = {
  heading: 'var(--font-heading)',
  body: 'var(--font-body)',
} as const;

/** Ícones Lucide: o design system pede traço 2.75 em todo lugar. */
export const ICON_STROKE_WIDTH = 2.75;

/**
 * Larguras mínimas dos grids `auto-fit` descritas no handoff.
 * Uso: `gridTemplateColumns: autoFit(GRID.kpi)`.
 */
export const GRID = {
  /** 4 KPIs por linha em tela cheia. */
  kpi: 190,
  /** Cards médios: categorias, assinaturas, contas. */
  card: 268,
  cardWide: 320,
  /** Painéis largos: fluxo de caixa, tabelas. */
  panel: 300,
} as const;

export const autoFit = (min: number) => `repeat(auto-fit, minmax(${min}px, 1fr))`;
