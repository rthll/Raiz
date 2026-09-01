/**
 * Contraste dos pares de cor que o sistema realmente usa.
 *
 * O axe não mede contraste no jsdom (não há layout nem cor computada), então a
 * conferência é feita aqui, sobre os valores dos tokens do Organic.
 *
 * Régua WCAG 2.1 AA: 4.5:1 para texto normal, 3:1 para texto grande
 * (≥ 18.66px, ou ≥ 14px em negrito) e para componentes de interface.
 */
import { describe, expect, it } from 'vitest';

// Tokens do Organic — copiados de packages/ui/src/organic/styles.css.
const T = {
  bg: '#f5ead8',
  surface: '#ebddc5',
  text: '#201e1d',
  accent: '#c67139',
  neutral100: '#f9f4ed',
  neutral200: '#eee7db',
  neutral500: '#a19786',
  neutral600: '#82796a',
  neutral700: '#645c50',
  neutral800: '#474238',
  neutral900: '#2e2b25',
  accent200: '#ffe1d0',
  accent700: '#8c491a',
  accent800: '#643312',
  accent900: '#402310',
  accent2_100: '#f0fae1',
  accent2_200: '#e1eecc',
  accent2_700: '#56633f',
  accent2_800: '#3d472b',
  estouro: '#8c491a',
} as const;

function canal(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminancia(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = canal((n >> 16) & 255);
  const g = canal((n >> 8) & 255);
  const b = canal(n & 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razão de contraste WCAG entre duas cores opacas. */
export function contraste(a: string, b: string): number {
  const la = luminancia(a);
  const lb = luminancia(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Mistura duas cores — equivalente ao `color-mix(in srgb, a X%, b)`. */
function misturar(a: string, b: string, pctA: number): string {
  const na = Number.parseInt(a.slice(1), 16);
  const nb = Number.parseInt(b.slice(1), 16);
  const canalMix = (desloc: number) => {
    const ca = (na >> desloc) & 255;
    const cb = (nb >> desloc) & 255;
    return Math.round(ca * pctA + cb * (1 - pctA));
  };
  return `#${[16, 8, 0].map((d) => canalMix(d).toString(16).padStart(2, '0')).join('')}`;
}

const AA_NORMAL = 4.5;
const AA_GRANDE = 3;

describe('texto normal (≥ 4.5:1)', () => {
  const casos: Array<[string, string, string]> = [
    ['texto sobre o fundo', T.text, T.bg],
    ['texto sobre superfície', T.text, T.surface],
    ['texto sobre neutral-100 (o main)', T.text, T.neutral100],
    ['nav ativo: accent-900 sobre accent-200', T.accent900, T.accent200],
    ['banner de alerta: accent-900 sobre accent-200', T.accent900, T.accent200],
    ['erro de campo: accent-700 sobre superfície', T.accent700, T.surface],
    ['erro de campo: accent-700 sobre neutral-100', T.accent700, T.neutral100],
    ['toast de sucesso: accent-2-900 sobre accent-2-200', '#272e1b', T.accent2_200],
    ['chip normal: accent-2-800 sobre accent-2-100', T.accent2_800, T.accent2_100],
    ['chip de estouro: accent-800 sobre accent-200', T.accent800, T.accent200],
    ['entrada em verde: accent-2-700 sobre neutral-100', T.accent2_700, T.neutral100],
    ['saída em terracota: accent-700 sobre neutral-100', T.accent700, T.neutral100],
    ['tag neutra: neutral-800 sobre neutral-100', T.neutral800, T.neutral100],
    ['KPI escuro: neutral-100 sobre accent-900', T.neutral100, T.accent900],
    ['cartão escuro: neutral-100 sobre accent-900', T.neutral100, T.accent900],
    ['rótulo de campo: 70% do texto sobre superfície', misturar(T.text, T.surface, 0.7), T.surface],
    ['nota do KPI: neutral-700 sobre superfície', T.neutral700, T.surface],
  ];

  for (const [nome, frente, fundo] of casos) {
    it(`${nome}`, () => {
      const razao = contraste(frente, fundo);
      expect(razao, `${frente} sobre ${fundo} = ${razao.toFixed(2)}:1`).toBeGreaterThanOrEqual(
        AA_NORMAL,
      );
    });
  }
});

describe('texto grande e chrome (≥ 3:1)', () => {
  const casos: Array<[string, string, string]> = [
    ['valor do KPI em Caprasimo 27px', T.text, T.surface],
    ['barra de orçamento estourada sobre a trilha', T.estouro, T.neutral200],
    ['borda de seleção do cartão: accent sobre neutral-100', T.accent, T.neutral100],
    ['marca: accent sobre o fundo', T.accent, T.bg],
  ];

  for (const [nome, frente, fundo] of casos) {
    it(`${nome}`, () => {
      const razao = contraste(frente, fundo);
      expect(razao, `${frente} sobre ${fundo} = ${razao.toFixed(2)}:1`).toBeGreaterThanOrEqual(
        AA_GRANDE,
      );
    });
  }
});

describe('limites conhecidos do design system', () => {
  /**
   * O próprio guia do Organic diz: "The accent-to-ground pair is tuned to at
   * least 3:1 — enough for icons, large text and interface chrome, not for body
   * copy". O `.card-kicker` (10px em accent) e o `.btn-ghost` (14px em accent)
   * ficam abaixo de 4.5:1 por decisão de design, não por descuido nosso.
   *
   * Este teste **documenta** o limite e trava o valor: se o token mudar e piorar,
   * ficamos sabendo. Corrigir exigiria redefinir o design system, o que o handoff
   * proíbe explicitamente.
   */
  it('accent sobre o fundo fica entre 3:1 e 4.5:1 — só para texto grande e chrome', () => {
    const razao = contraste(T.accent, T.bg);
    expect(razao).toBeGreaterThanOrEqual(AA_GRANDE);
    expect(razao).toBeLessThan(AA_NORMAL);
  });

  it('texto pequeno em accent deve usar accent-700, que passa em AA', () => {
    expect(contraste(T.accent700, T.bg)).toBeGreaterThanOrEqual(AA_NORMAL);
    expect(contraste(T.accent700, T.neutral100)).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it('neutral-600 não serve para texto pequeno sobre superfície', () => {
    // Usado no subtítulo da marca e em detalhes de 11px. Fica abaixo de AA.
    expect(contraste(T.neutral600, T.surface)).toBeLessThan(AA_NORMAL);
    // neutral-700 é o degrau que resolve.
    expect(contraste(T.neutral700, T.surface)).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  /**
   * DOIS DEFEITOS DE ACESSIBILIDADE NO DESIGN SYSTEM.
   *
   * Vêm de `.btn-primary` e `.table th` em `organic/styles.css`, que o handoff
   * manda copiar sem alterar. Estão registrados aqui com o valor medido para que
   * (a) ninguém pense que passaram despercebidos e (b) o teste quebre se alguém
   * mexer nos tokens e piorar ainda mais.
   *
   * Corrigir exige decisão de design, não cabe fazer por conta própria dentro da
   * regra do handoff. As duas saídas que de fato passam em AA estão medidas
   * abaixo — o resto da rampa não resolve.
   */
  it('DEFEITO: o rótulo do botão primário fica em 3,03:1 (AA pede 4,5:1)', () => {
    const razao = contraste(T.bg, T.accent);
    expect(razao).toBeCloseTo(3.03, 2);
    expect(razao).toBeLessThan(AA_NORMAL);

    // Opção A — escurecer o rótulo, preservando a terracota do botão: 4,60:1.
    expect(contraste(T.text, T.accent)).toBeGreaterThanOrEqual(AA_NORMAL);
    // Opção B — escurecer o botão para accent-700, preservando o rótulo: 5,72:1.
    expect(contraste(T.bg, T.accent700)).toBeGreaterThanOrEqual(AA_NORMAL);

    // accent-600 NÃO resolve (3,77:1) — é o erro fácil de cometer aqui.
    expect(contraste(T.bg, '#b2622d')).toBeLessThan(AA_NORMAL);
  });

  it('DEFEITO: o cabeçalho de tabela fica em 3,99:1 (AA pede 4,5:1)', () => {
    // `.table th` usa color-mix(text 60%) em 11px maiúsculo.
    const razao = contraste(misturar(T.text, T.surface, 0.6), T.surface);
    expect(razao).toBeCloseTo(3.99, 2);
    expect(razao).toBeLessThan(AA_NORMAL);

    // 70% já resolveria, sem mudar o desenho.
    expect(contraste(misturar(T.text, T.surface, 0.7), T.surface)).toBeGreaterThanOrEqual(
      AA_NORMAL,
    );
  });
});
