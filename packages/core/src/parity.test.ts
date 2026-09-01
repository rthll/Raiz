/**
 * Paridade com o protótipo.
 *
 * A classe `Component` do handoff é a fonte da verdade das regras de cálculo.
 * Este arquivo replica os trechos relevantes dela *literalmente* e compara com a
 * implementação de `@raiz/core`, para que qualquer refatoração futura que mude um
 * número quebre o build em vez de passar despercebida.
 *
 * Fonte: design_handoff_raiz_financas/design/Raiz Gestao Financeira.dc.html
 */
import { describe, expect, it } from 'vitest';
import { monthlyCost, portfolioProjection, weightedAverageRate, type AssetLike } from './finance.js';
import { donutSlices } from './palette.js';
import { formatBRL, formatPercent } from './money.js';

// ─────────────────────────────── réplica literal do protótipo

const protoAtivos = [
  { id: 'a1', nome: 'Tesouro IPCA+ 2035', classe: 'Renda fixa', valor: 42000, taxa: 11.2, aporte: 400 },
  { id: 'a2', nome: 'CDB liquidez diária', classe: 'Renda fixa', valor: 18500, taxa: 10.4, aporte: 300 },
  { id: 'a3', nome: 'FII de logística', classe: 'Fundos imobiliários', valor: 26300, taxa: 8.6, aporte: 250 },
  { id: 'a4', nome: 'ETF S&P 500', classe: 'Ações exterior', valor: 31700, taxa: 12.5, aporte: 500 },
  { id: 'a5', nome: 'Carteira de ações BR', classe: 'Ações Brasil', valor: 14900, taxa: 9.8, aporte: 150 },
  { id: 'a6', nome: 'Bitcoin', classe: 'Cripto', valor: 9400, taxa: 15, aporte: 100 },
];

const protoInvestido = protoAtivos.reduce((a, x) => a + x.valor, 0);

/** `fv()` do protótipo, caractere por caractere. */
function protoFv(pv: number, anual: number, pmt: number, meses: number): number {
  const r = Math.pow(1 + Math.max(0.0001, anual), 1 / 12) - 1;
  return pv * Math.pow(1 + r, meses) + pmt * ((Math.pow(1 + r, meses) - 1) / r);
}

/** `projDe()` do protótipo. */
function protoProjDe(mesesN: number, ajuste: number, aporteExtra: number): number {
  return protoAtivos.reduce((acc, x) => {
    const extra = protoInvestido ? aporteExtra * (x.valor / protoInvestido) : 0;
    return acc + protoFv(x.valor, (x.taxa + ajuste) / 100, x.aporte + extra, mesesN);
  }, 0);
}

/** `mensal()` do protótipo. */
function protoMensal(a: { valor: number; periodo: string }): number {
  const div = ({ Mensal: 1, Trimestral: 3, Semestral: 6, Anual: 12 } as Record<string, number>)[
    a.periodo
  ] ?? 1;
  return a.valor / div;
}

/** `money()` do protótipo. */
function protoMoney(v: number, dec?: number): string {
  const d = dec === 0 ? 0 : 2;
  return (
    'R$ ' +
    Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })
  );
}

/** `pct()` do protótipo. */
function protoPct(v: number): string {
  return (v || 0).toFixed(0).replace('.', ',') + '%';
}

// ─────────────────────────────── o mesmo dado, no formato do core

const coreAtivos: AssetLike[] = protoAtivos.map((a) => ({
  valor: a.valor,
  taxa: a.taxa,
  aporteMensal: a.aporte,
}));

// ─────────────────────────────── comparações

describe('paridade: projeção de carteira', () => {
  // Varre o espaço inteiro que os três sliders do simulador permitem.
  const prazos = [1, 2, 5, 10, 15, 20, 25, 30];
  const ajustes = [-3, -1.5, 0, 0.5, 2, 4];
  const extras = [0, 100, 500, 1500, 3000];

  it('bate com o protótipo em toda combinação dos sliders', () => {
    let comparacoes = 0;
    for (const anos of prazos) {
      for (const ajusteTaxa of ajustes) {
        for (const aporteExtra of extras) {
          const esperado = protoProjDe(anos * 12, ajusteTaxa, aporteExtra);
          const obtido = portfolioProjection(coreAtivos, anos, { ajusteTaxa, aporteExtra }).total;
          expect(obtido).toBeCloseTo(esperado, 6);
          comparacoes++;
        }
      }
    }
    expect(comparacoes).toBe(prazos.length * ajustes.length * extras.length);
  });

  it('bate nos 5 marcos exibidos no gráfico de provisão', () => {
    const p = portfolioProjection(coreAtivos, 10, { ajusteTaxa: 1, aporteExtra: 400 });
    for (const marco of p.marcos) {
      expect(marco.total).toBeCloseTo(protoProjDe(marco.anos * 12, 1, 400), 6);
    }
  });

  it('bate na coluna "Em N anos" de cada ativo da tabela', () => {
    const anos = 10;
    const p = portfolioProjection(coreAtivos, anos, { ajusteTaxa: 0, aporteExtra: 1000 });
    p.porAtivo.forEach(({ index, total }) => {
      const x = protoAtivos[index]!;
      const extra = 1000 * (x.valor / protoInvestido);
      expect(total).toBeCloseTo(protoFv(x.valor, x.taxa / 100, x.aporte + extra, anos * 12), 6);
    });
  });

  it('reproduz os valores de referência do protótipo no cenário padrão', () => {
    const p = portfolioProjection(coreAtivos, 10);
    expect(p.total).toBeCloseTo(772500.282037, 4);
    expect(p.totalAportado).toBe(142800 + 1700 * 120);
    expect(formatBRL(p.total, { decimals: 0 })).toBe(protoMoney(protoProjDe(120, 0, 0), 0));
  });

  it('bate na taxa média ponderada', () => {
    const esperado =
      protoAtivos.reduce((a, x) => a + x.taxa * x.valor, 0) / protoInvestido;
    expect(weightedAverageRate(coreAtivos)).toBeCloseTo(esperado, 10);
    expect(formatPercent(weightedAverageRate(coreAtivos))).toBe(protoPct(esperado));
  });
});

describe('paridade: mensalização de assinaturas', () => {
  const protoAssinaturas = [
    { nome: 'Streaming de vídeo', valor: 55.9, periodo: 'Mensal', status: 'Ativa' },
    { nome: 'Música em família', valor: 34.9, periodo: 'Mensal', status: 'Ativa' },
    { nome: 'Nuvem 2 TB', valor: 27.9, periodo: 'Mensal', status: 'Ativa' },
    { nome: 'Academia', valor: 129, periodo: 'Mensal', status: 'Ativa' },
    { nome: 'Suíte de design', valor: 1290, periodo: 'Anual', status: 'Ativa' },
    { nome: 'Seguro do celular', valor: 24.9, periodo: 'Mensal', status: 'Ativa' },
    { nome: 'Jornal digital', valor: 119.7, periodo: 'Trimestral', status: 'Pausada' },
    { nome: 'App de meditação', valor: 0, periodo: 'Mensal', status: 'Teste grátis' },
  ];

  const PERIODO: Record<string, 'MENSAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL'> = {
    Mensal: 'MENSAL',
    Trimestral: 'TRIMESTRAL',
    Semestral: 'SEMESTRAL',
    Anual: 'ANUAL',
  };

  it('mensaliza cada assinatura igual ao protótipo', () => {
    for (const a of protoAssinaturas) {
      expect(monthlyCost({ valor: a.valor, periodo: PERIODO[a.periodo]! })).toBeCloseTo(
        protoMensal(a),
        10,
      );
    }
  });

  it('soma o mesmo custo mensal, excluindo as pausadas', () => {
    const esperado = protoAssinaturas
      .filter((a) => a.status !== 'Pausada')
      .reduce((acc, a) => acc + protoMensal(a), 0);
    const obtido = protoAssinaturas
      .filter((a) => a.status !== 'Pausada')
      .reduce((acc, a) => acc + monthlyCost({ valor: a.valor, periodo: PERIODO[a.periodo]! }), 0);
    expect(obtido).toBeCloseTo(esperado, 10);
    // O KPI de custo anual do protótipo é mensal * 12.
    expect(formatBRL(obtido * 12, { decimals: 0 })).toBe(protoMoney(esperado * 12, 0));
  });
});

describe('paridade: donut de alocação', () => {
  it('gera as mesmas fatias do conic-gradient', () => {
    const classes: Record<string, number> = {};
    protoAtivos.forEach((x) => {
      classes[x.classe] = (classes[x.classe] ?? 0) + x.valor;
    });
    const CLASSE_COR: Record<string, string> = {
      'Renda fixa': '#d67f48',
      'Fundos imobiliários': '#8fa073',
      'Ações exterior': '#b2622d',
      'Ações Brasil': '#aebf92',
      Cripto: '#645c50',
    };
    let acumulado = 0;
    const esperado = Object.keys(classes).map((k) => {
      const inicio = (acumulado / protoInvestido) * 100;
      acumulado += classes[k]!;
      const fim = (acumulado / protoInvestido) * 100;
      return `${CLASSE_COR[k]} ${inicio.toFixed(1)}% ${fim.toFixed(1)}%`;
    });

    const obtido = donutSlices(
      Object.keys(classes).map((classe) => ({ classe, valor: classes[classe]! })),
    );
    expect(obtido.map((f) => f.stop)).toEqual(esperado);
    // As fatias fecham o círculo.
    expect(obtido.reduce((a, f) => a + f.pct, 0)).toBeCloseTo(100, 6);
  });
});

describe('paridade: formatação', () => {
  const amostras = [0, 1, 55.9, 612.4, 7783.7, 21881.25, 142800, 772500.282037];

  it('formata igual ao money() do protótipo, com 2 e com 0 decimais', () => {
    for (const v of amostras) {
      expect(formatBRL(v)).toBe(protoMoney(v));
      expect(formatBRL(v, { decimals: 0 })).toBe(protoMoney(v, 0));
    }
  });

  it('formata percentuais igual ao pct() do protótipo', () => {
    for (const v of [0, 11.010154, 45.9, 61.333, 99.6, 128.4]) {
      expect(formatPercent(v)).toBe(protoPct(v));
    }
  });
});
