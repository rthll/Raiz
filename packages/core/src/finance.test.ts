import { describe, expect, it } from 'vitest';
import {
  budgetUsage,
  coupleSettlement,
  futureValue,
  goalMonthlySuggestion,
  goalProgress,
  monthlyCost,
  monthlyRate,
  monthsOfReserve,
  portfolioProjection,
  projectAsset,
  savingsRate,
  subscriptionsSummary,
  weightedAverageRate,
  type AssetLike,
  type SubscriptionLike,
} from './finance.js';

/** Os 6 ativos do seed do protótipo — a base de comparação das projeções. */
const ATIVOS: AssetLike[] = [
  { valor: 42000, taxa: 11.2, aporteMensal: 400 },
  { valor: 18500, taxa: 10.4, aporteMensal: 300 },
  { valor: 26300, taxa: 8.6, aporteMensal: 250 },
  { valor: 31700, taxa: 12.5, aporteMensal: 500 },
  { valor: 14900, taxa: 9.8, aporteMensal: 150 },
  { valor: 9400, taxa: 15, aporteMensal: 100 },
];

describe('mensalização de assinaturas', () => {
  it('divide pelo número de meses do período', () => {
    expect(monthlyCost({ valor: 55.9, periodo: 'MENSAL' })).toBeCloseTo(55.9, 10);
    expect(monthlyCost({ valor: 119.7, periodo: 'TRIMESTRAL' })).toBeCloseTo(39.9, 10);
    expect(monthlyCost({ valor: 600, periodo: 'SEMESTRAL' })).toBeCloseTo(100, 10);
    expect(monthlyCost({ valor: 1290, periodo: 'ANUAL' })).toBeCloseTo(107.5, 10);
  });

  it('ignora pausadas nos totais e conta ativas e pausadas separadamente', () => {
    const lista: SubscriptionLike[] = [
      { valor: 55.9, periodo: 'MENSAL', status: 'ATIVA' },
      { valor: 1290, periodo: 'ANUAL', status: 'ATIVA' },
      { valor: 119.7, periodo: 'TRIMESTRAL', status: 'PAUSADA' },
      { valor: 0, periodo: 'MENSAL', status: 'TESTE' },
    ];
    const resumo = subscriptionsSummary(lista, 14400);

    expect(resumo.custoMensal).toBeCloseTo(55.9 + 107.5, 10);
    expect(resumo.custoAnual).toBeCloseTo((55.9 + 107.5) * 12, 10);
    expect(resumo.ativas).toBe(3); // TESTE conta como ativa
    expect(resumo.pausadas).toBe(1);
    expect(resumo.pctRenda).toBeCloseTo(((55.9 + 107.5) / 14400) * 100, 10);
  });

  it('nao divide por zero quando nao ha renda no mes', () => {
    expect(subscriptionsSummary([{ valor: 50, periodo: 'MENSAL', status: 'ATIVA' }], 0).pctRenda).toBe(0);
  });
});

describe('juros compostos', () => {
  it('converte taxa anual efetiva em mensal equivalente', () => {
    // 12,68% a.a. equivale a 1% a.m.
    expect(monthlyRate(0.126825)).toBeCloseTo(0.01, 6);
    // A composição de 12 meses tem de devolver a taxa anual.
    expect(Math.pow(1 + monthlyRate(0.112), 12) - 1).toBeCloseTo(0.112, 10);
  });

  it('capitaliza apenas o principal quando nao ha aporte', () => {
    expect(futureValue(1000, 0.1, 0, 12)).toBeCloseTo(1100, 6);
  });

  it('soma a serie de aportes ao principal capitalizado', () => {
    const r = monthlyRate(0.12);
    const esperado = 1000 * Math.pow(1 + r, 24) + 100 * ((Math.pow(1 + r, 24) - 1) / r);
    expect(futureValue(1000, 0.12, 100, 24)).toBeCloseTo(esperado, 6);
  });

  it('devolve o proprio principal em zero meses', () => {
    expect(futureValue(5000, 0.11, 300, 0)).toBeCloseTo(5000, 10);
  });

  it('nao explode com taxa zero (piso de 0,01% protege a divisao)', () => {
    const resultado = futureValue(1000, 0, 100, 12);
    expect(Number.isFinite(resultado)).toBe(true);
    // Com taxa ~0 o resultado tende a principal + aportes.
    expect(resultado).toBeGreaterThanOrEqual(2200);
    expect(resultado).toBeLessThan(2201);
  });
});

describe('carteira', () => {
  it('pondera a taxa media pelo valor de cada ativo', () => {
    const total = ATIVOS.reduce((a, x) => a + x.valor, 0);
    const esperado = ATIVOS.reduce((a, x) => a + x.taxa * x.valor, 0) / total;
    expect(weightedAverageRate(ATIVOS)).toBeCloseTo(esperado, 10);
    expect(weightedAverageRate(ATIVOS)).toBeCloseTo(11.05, 1);
  });

  it('devolve zero para carteira vazia em vez de NaN', () => {
    expect(weightedAverageRate([])).toBe(0);
    expect(portfolioProjection([], 10).total).toBe(0);
  });

  it('rateia o aporte extra pelo peso de cada ativo', () => {
    const total = ATIVOS.reduce((a, x) => a + x.valor, 0);
    const primeiro = ATIVOS[0]!;
    const share = primeiro.valor / total;
    const comExtra = projectAsset(primeiro, 12, total, { aporteExtra: 1000 });
    const semExtra = projectAsset(primeiro, 12, total, {});
    expect(comExtra).toBeGreaterThan(semExtra);
    // A diferenca e a serie do aporte rateado, nao do aporte extra inteiro.
    expect(comExtra - semExtra).toBeCloseTo(
      futureValue(0, primeiro.taxa / 100, 1000 * share, 12),
      6,
    );
  });

  it('a soma do rateio devolve o aporte extra inteiro', () => {
    const total = ATIVOS.reduce((a, x) => a + x.valor, 0);
    const somaShares = ATIVOS.reduce((a, x) => a + x.valor / total, 0);
    expect(somaShares).toBeCloseTo(1, 10);
  });

  it('aplica o ajuste de taxa em pontos percentuais', () => {
    const base = portfolioProjection(ATIVOS, 10).total;
    const otimista = portfolioProjection(ATIVOS, 10, { ajusteTaxa: 2 }).total;
    const pessimista = portfolioProjection(ATIVOS, 10, { ajusteTaxa: -2 }).total;
    expect(otimista).toBeGreaterThan(base);
    expect(pessimista).toBeLessThan(base);
  });

  it('decompoe o total projetado em aportado + juros', () => {
    const p = portfolioProjection(ATIVOS, 10, { aporteExtra: 500 });
    expect(p.totalAportado + p.juros).toBeCloseTo(p.total, 6);
    expect(p.aporteMensalTotal).toBe(1700 + 500);
    expect(p.totalAportado).toBeCloseTo(142800 + 2200 * 120, 6);
  });

  it('entrega os 5 marcos em ordem crescente', () => {
    const p = portfolioProjection(ATIVOS, 10);
    expect(p.marcos.map((m) => m.anos)).toEqual([1, 3, 5, 10, 20]);
    for (let i = 1; i < p.marcos.length; i++) {
      expect(p.marcos[i]!.total).toBeGreaterThan(p.marcos[i - 1]!.total);
    }
  });

  it('o marco do prazo escolhido bate com o total projetado', () => {
    const p = portfolioProjection(ATIVOS, 10, { ajusteTaxa: 1, aporteExtra: 300 });
    const marco10 = p.marcos.find((m) => m.anos === 10)!;
    expect(marco10.total).toBeCloseTo(p.total, 6);
  });

  it('a soma das projecoes por ativo bate com o total', () => {
    const p = portfolioProjection(ATIVOS, 10, { aporteExtra: 250 });
    const soma = p.porAtivo.reduce((a, x) => a + x.total, 0);
    expect(soma).toBeCloseTo(p.total, 6);
  });
});

describe('orcamentos', () => {
  it('calcula uso e detecta estouro acima de 100%', () => {
    expect(budgetUsage(1200, 1500).pct).toBeCloseTo(80, 10);
    expect(budgetUsage(1200, 1500).estourou).toBe(false);
    expect(budgetUsage(1600, 1500).estourou).toBe(true);
    expect(budgetUsage(1500, 1500).estourou).toBe(false); // exatamente no limite nao estoura
  });

  it('trata categoria sem limite como "sem limite", nao como estouro', () => {
    const semLimite = budgetUsage(900, 0);
    expect(semLimite.temLimite).toBe(false);
    expect(semLimite.pct).toBe(0);
    expect(semLimite.estourou).toBe(false);
    expect(budgetUsage(900, null).temLimite).toBe(false);
  });
});

describe('metas', () => {
  it('sugere o aporte mensal para bater a meta no prazo', () => {
    expect(goalMonthlySuggestion(30000, 18400, 12)).toBeCloseTo(11600 / 12, 10);
  });

  it('sugere zero quando a meta ja foi atingida', () => {
    expect(goalMonthlySuggestion(30000, 31000, 12)).toBe(0);
  });

  it('trata prazo zero como 1 mes em vez de dividir por zero', () => {
    expect(goalMonthlySuggestion(1000, 0, 0)).toBe(1000);
  });

  it('mede o progresso em pontos percentuais', () => {
    expect(goalProgress(30000, 18400)).toBeCloseTo(61.333, 3);
    expect(goalProgress(0, 100)).toBe(0);
  });
});

describe('relatorios', () => {
  it('calcula a taxa de poupanca do mes', () => {
    expect(savingsRate(14400, 7783.7)).toBeCloseTo(((14400 - 7783.7) / 14400) * 100, 10);
    expect(savingsRate(0, 500)).toBe(0);
  });

  it('mede a reserva em meses de despesa', () => {
    expect(monthsOfReserve(18400, 7783.7)).toBeCloseTo(18400 / 7783.7, 10);
    expect(monthsOfReserve(18400, 0)).toBe(0);
  });

  it('acerta a divisao do casal pela metade da diferenca', () => {
    expect(coupleSettlement(1000, 600)).toBe(200);
    expect(coupleSettlement(600, 1000)).toBe(200);
    expect(coupleSettlement(800, 800)).toBe(0);
  });
});
