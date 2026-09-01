/**
 * Cores de dados — as únicas cores fora dos tokens do Organic, usadas em
 * gráficos e categorias. Listadas no handoff em "Design tokens".
 */

export const DATA_COLORS = [
  '#d67f48', // terracota
  '#8fa073', // sálvia
  '#b2622d', // âmbar
  '#aebf92', // musgo
  '#645c50', // terra
  '#f6a06b',
  '#728157',
  '#56633f',
] as const;

export type DataColor = (typeof DATA_COLORS)[number];

/** Barra de orçamento estourado. */
export const OVER_BUDGET_COLOR = '#8c491a';

/** Meta batida (barra da meta ≥ 100%). */
export const GOAL_REACHED_COLOR = '#8fa073';

/** Cor de fallback quando uma categoria ou classe não tem cor definida. */
export const FALLBACK_COLOR = '#a19786';

/** Cores das 5 classes de ativo do donut de alocação. */
export const ASSET_CLASS_COLORS: Record<string, string> = {
  'Renda fixa': '#d67f48',
  'Fundos imobiliários': '#8fa073',
  'Ações exterior': '#b2622d',
  'Ações Brasil': '#aebf92',
  Cripto: '#645c50',
};

/** As 5 cores oferecidas no diálogo de categoria, com o nome que aparece no select. */
export const CATEGORY_COLOR_OPTIONS = [
  { nome: 'Terracota', cor: '#d67f48' },
  { nome: 'Sálvia', cor: '#8fa073' },
  { nome: 'Âmbar', cor: '#b2622d' },
  { nome: 'Terra', cor: '#645c50' },
  { nome: 'Musgo', cor: '#aebf92' },
] as const;

export function assetClassColor(classe: string): string {
  return ASSET_CLASS_COLORS[classe] ?? FALLBACK_COLOR;
}

/**
 * Fatias do donut de alocação, no formato que o `conic-gradient` espera:
 * `cor inicio% fim%`.
 */
export function donutSlices(
  groups: ReadonlyArray<{ classe: string; valor: number }>,
): Array<{ classe: string; cor: string; pct: number; stop: string }> {
  const total = groups.reduce((acc, g) => acc + g.valor, 0);
  if (total <= 0) return [];
  let acumulado = 0;
  return groups.map((g) => {
    const inicio = (acumulado / total) * 100;
    acumulado += g.valor;
    const fim = (acumulado / total) * 100;
    const cor = assetClassColor(g.classe);
    return {
      classe: g.classe,
      cor,
      pct: (g.valor / total) * 100,
      stop: `${cor} ${inicio.toFixed(1)}% ${fim.toFixed(1)}%`,
    };
  });
}
