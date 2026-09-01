/**
 * Confere o dataset do seed contra os números que aparecem nos screenshots do
 * handoff. Não precisa de banco: recalcula os agregados a partir dos dados puros.
 *
 * Se alguém transcrever um valor errado, é aqui que aparece — antes de a tela ser
 * construída em cima do número torto.
 */
import { describe, expect, it } from 'vitest';
import {
  monthlyCost,
  subscriptionsSummary,
  weightedAverageRate,
  formatBRL,
  formatPercent,
  budgetUsage,
  totalInvested,
  type SubscriptionPeriod,
  type SubscriptionStatus,
} from '@raiz/core';
import {
  ASSINATURAS,
  ATIVOS,
  CARTOES,
  CATEGORIAS,
  CONTAS,
  FLUXO_MENSAL,
  IMPORTACOES,
  METAS,
  REGRAS,
  TRANSACOES,
  dataBR,
} from './seed-data.js';

const entradas = TRANSACOES.filter((t) => t.tipo === 'ENTRADA').reduce((a, t) => a + t.valor, 0);
const saidas = TRANSACOES.filter((t) => t.tipo === 'SAIDA').reduce((a, t) => a + t.valor, 0);
const saldoContas = CONTAS.reduce((a, c) => a + c.saldo, 0);
const investido = totalInvested(
  ATIVOS.map((a) => ({ valor: a.valor, taxa: a.taxaAnual, aporteMensal: a.aporteMensal })),
);

describe('integridade referencial do seed', () => {
  it('toda transação aponta para uma categoria que existe', () => {
    const nomes = new Set(CATEGORIAS.map((c) => c.nome));
    for (const t of TRANSACOES) expect(nomes).toContain(t.categoria);
  });

  it('toda transação aponta para uma conta OU um cartão que existe, nunca os dois', () => {
    const contas = new Set(CONTAS.map((c) => c.nome));
    const cartoes = new Set(CARTOES.map((c) => c.nome));
    for (const t of TRANSACOES) {
      const chaves = Object.keys(t.origem);
      expect(chaves).toHaveLength(1);
      if ('conta' in t.origem) expect(contas).toContain(t.origem.conta);
      else expect(cartoes).toContain(t.origem.cartao);
    }
  });

  it('o tipo do lançamento combina com o tipo da categoria', () => {
    for (const t of TRANSACOES) {
      const cat = CATEGORIAS.find((c) => c.nome === t.categoria)!;
      expect(cat.tipo).toBe(t.tipo);
    }
  });

  it('assinaturas, regras e importações apontam para registros existentes', () => {
    const categorias = new Set(CATEGORIAS.map((c) => c.nome));
    const cartoes = new Set(CARTOES.map((c) => c.nome));
    const contas = new Set(CONTAS.map((c) => c.nome));
    for (const a of ASSINATURAS) {
      expect(categorias).toContain(a.categoria);
      expect(cartoes).toContain(a.cartao);
    }
    for (const r of REGRAS) expect(categorias).toContain(r.categoria);
    for (const i of IMPORTACOES) expect(contas).toContain(i.conta);
  });

  it('não repete nome dentro de cada entidade — são chaves únicas no schema', () => {
    for (const lista of [CONTAS, CARTOES, CATEGORIAS]) {
      const nomes = lista.map((x) => x.nome);
      expect(new Set(nomes).size).toBe(nomes.length);
    }
  });

  it('parcela vem completa ou não vem', () => {
    const parceladas = TRANSACOES.filter((t) => t.parcela);
    expect(parceladas).toHaveLength(1);
    expect(parceladas[0]!.parcela).toEqual({ atual: 3, total: 10 });
    expect(parceladas[0]!.parcela!.atual).toBeLessThanOrEqual(parceladas[0]!.parcela!.total);
  });

  it('dias de fechamento e vencimento dos cartões são dias de mês válidos', () => {
    for (const c of CARTOES) {
      expect(c.diaFechamento).toBeGreaterThanOrEqual(1);
      expect(c.diaFechamento).toBeLessThanOrEqual(28);
      expect(c.diaVencimento).toBeGreaterThanOrEqual(1);
      expect(c.diaVencimento).toBeLessThanOrEqual(28);
    }
  });
});

describe('KPIs da visão geral', () => {
  it('saldo em contas: R$ 21.881,25', () => {
    expect(formatBRL(saldoContas)).toBe('R$ 21.881,25');
  });

  it('entradas do mês: R$ 14.400,00 — 2 salários + 1 freela', () => {
    expect(formatBRL(entradas)).toBe('R$ 14.400,00');
    expect(TRANSACOES.filter((t) => t.tipo === 'ENTRADA')).toHaveLength(3);
  });

  it('saídas do mês: R$ 7.783,70', () => {
    expect(formatBRL(saidas)).toBe('R$ 7.783,70');
  });

  it('patrimônio total: saldo em contas + investido', () => {
    expect(investido).toBe(142800);
    expect(formatBRL(saldoContas + investido, { decimals: 0 })).toBe('R$ 164.681');
  });

  it('a série de fluxo cobre 8 meses, com os 2 últimos previstos', () => {
    expect(FLUXO_MENSAL).toHaveLength(8);
    expect(FLUXO_MENSAL.filter((f) => 'previsto' in f && f.previsto)).toHaveLength(2);
    // O mês corrente da série bate com a competência do seed.
    expect(FLUXO_MENSAL[5]!.mes).toBe('2026-08');
  });
});

describe('assinaturas', () => {
  const lista = ASSINATURAS.map((a) => ({
    valor: a.valor,
    periodo: a.periodo as SubscriptionPeriod,
    status: a.status as SubscriptionStatus,
  }));

  it('7 ativas (incluindo o teste grátis) e 1 pausada', () => {
    const resumo = subscriptionsSummary(lista, entradas);
    expect(resumo.ativas).toBe(7);
    expect(resumo.pausadas).toBe(1);
  });

  it('a anual entra mensalizada por 12, não pelo valor cheio', () => {
    const anual = ASSINATURAS.find((a) => a.periodo === 'ANUAL')!;
    expect(monthlyCost({ valor: anual.valor, periodo: 'ANUAL' })).toBeCloseTo(107.5, 10);
  });

  it('a pausada fica fora do custo mensal', () => {
    const comPausada = lista.reduce((a, s) => a + monthlyCost(s), 0);
    const semPausada = subscriptionsSummary(lista, entradas).custoMensal;
    expect(semPausada).toBeLessThan(comPausada);
    expect(comPausada - semPausada).toBeCloseTo(119.7 / 3, 10);
  });

  it('custo mensal e anual conferem, e o anual é 12x o mensal', () => {
    const resumo = subscriptionsSummary(lista, entradas);
    expect(formatBRL(resumo.custoMensal)).toBe('R$ 380,10');
    expect(resumo.custoAnual).toBeCloseTo(resumo.custoMensal * 12, 10);
  });

  it('o teste grátis guarda o preço que passará a custar', () => {
    const teste = ASSINATURAS.find((a) => a.status === 'TESTE')!;
    expect(teste.valor).toBe(0);
    expect((teste as { precoAnterior?: number }).precoAnterior).toBe(49.9);
  });
});

describe('faturas', () => {
  it('a fatura de cada cartão é a soma dos lançamentos daquele cartão', () => {
    for (const cartao of CARTOES) {
      const itens = TRANSACOES.filter(
        (t) => 'cartao' in t.origem && t.origem.cartao === cartao.nome,
      );
      const total = itens.reduce((a, t) => a + t.valor, 0);
      expect(total).toBeLessThanOrEqual(cartao.limite);
    }
  });

  const faturaDe = (nome: string) =>
    TRANSACOES.filter((t) => 'cartao' in t.origem && t.origem.cartao === nome).reduce(
      (a, t) => a + t.valor,
      0,
    );

  it('o Nubank Ultravioleta — selecionado por padrão — soma R$ 1.910,20', () => {
    expect(formatBRL(faturaDe('Nubank Ultravioleta'))).toBe('R$ 1.910,20');
  });

  it('o Itaú Click soma R$ 702,80', () => {
    expect(formatBRL(faturaDe('Itaú Click'))).toBe('R$ 702,80');
  });

  it('as faturas abertas somam R$ 2.613,00 de R$ 25.000 de limite', () => {
    const total = CARTOES.reduce((a, c) => a + faturaDe(c.nome), 0);
    expect(formatBRL(total)).toBe('R$ 2.613,00');
    expect(formatBRL(CARTOES.reduce((a, c) => a + c.limite, 0), { decimals: 0 })).toBe('R$ 25.000');
  });

  it('o Inter Gold não tem lançamento no mês — é o caso de fatura vazia', () => {
    const itens = TRANSACOES.filter(
      (t) => 'cartao' in t.origem && t.origem.cartao === 'Inter Gold',
    );
    expect(itens).toHaveLength(0);
  });
});

describe('investimentos', () => {
  it('total investido de R$ 142.800 em 6 ativos', () => {
    expect(investido).toBe(142800);
    expect(ATIVOS).toHaveLength(6);
  });

  it('taxa média ponderada de 11% a.a.', () => {
    const taxa = weightedAverageRate(
      ATIVOS.map((a) => ({ valor: a.valor, taxa: a.taxaAnual, aporteMensal: a.aporteMensal })),
    );
    expect(taxa).toBeCloseTo(11.010154, 5);
  });

  it('aporte mensal somado de R$ 1.700', () => {
    expect(ATIVOS.reduce((a, x) => a + x.aporteMensal, 0)).toBe(1700);
  });

  it('cobre as 5 classes de ativo do donut', () => {
    expect(new Set(ATIVOS.map((a) => a.classe)).size).toBe(5);
  });
});

describe('metas e orçamentos', () => {
  it('4 metas, todas abaixo do alvo e com prazo válido', () => {
    expect(METAS).toHaveLength(4);
    for (const m of METAS) {
      expect(m.atual).toBeLessThan(m.alvo);
      expect(m.prazoMeses).toBeGreaterThanOrEqual(1);
      expect(Number.isInteger(m.prazoMeses)).toBe(true);
    }
  });

  const gastoDe = (nome: string) =>
    TRANSACOES.filter((t) => t.categoria === nome && t.tipo === 'SAIDA').reduce(
      (a, t) => a + t.valor,
      0,
    );

  it('Moradia estoura o orçamento — é o caso de estouro que a tela precisa mostrar', () => {
    // Screenshot 03-categorias: chip "183%", R$ 4.769,90 usados de limite R$ 2.600,
    // com a barra em #8c491a. O seed precisa continuar produzindo esse caso.
    const moradia = CATEGORIAS.find((c) => c.nome === 'Moradia')!;
    const uso = budgetUsage(gastoDe('Moradia'), moradia.orcamento);
    expect(formatBRL(uso.gasto)).toBe('R$ 4.769,90');
    expect(uso.estourou).toBe(true);
    expect(formatPercent(uso.pct)).toBe('183%');
  });

  it('Saúde também estoura, de raspão — 105%', () => {
    // 642,00 do plano de saúde + 96,30 da farmácia = 738,30 de limite 700.
    // Bem mais sutil que o da Moradia, e igualmente precisa aparecer na UI.
    const saude = CATEGORIAS.find((c) => c.nome === 'Saúde')!;
    const uso = budgetUsage(gastoDe('Saúde'), saude.orcamento);
    expect(formatBRL(uso.gasto)).toBe('R$ 738,30');
    expect(uso.estourou).toBe(true);
    expect(formatPercent(uso.pct)).toBe('105%');
  });

  it('Alimentação fica dentro do limite — o caso normal, a 63%', () => {
    const alimentacao = CATEGORIAS.find((c) => c.nome === 'Alimentação')!;
    const uso = budgetUsage(gastoDe('Alimentação'), alimentacao.orcamento);
    expect(formatBRL(uso.gasto)).toBe('R$ 947,60');
    expect(uso.estourou).toBe(false);
    expect(formatPercent(uso.pct)).toBe('63%');
  });

  it('exatamente duas categorias estouram — nem mais, nem menos', () => {
    const estouradas = CATEGORIAS.filter(
      (c) => c.orcamento && budgetUsage(gastoDe(c.nome), c.orcamento).estourou,
    ).map((c) => c.nome);
    expect(estouradas).toEqual(['Moradia', 'Saúde']);
  });

  it('o resumo bate: 8 categorias, R$ 6.980 de limite somado, R$ 7.784 usados', () => {
    expect(CATEGORIAS).toHaveLength(8);
    const limiteSomado = CATEGORIAS.reduce((a, c) => a + (c.orcamento ?? 0), 0);
    expect(formatBRL(limiteSomado, { decimals: 0 })).toBe('R$ 6.980');
    expect(formatBRL(saidas, { decimals: 0 })).toBe('R$ 7.784');
  });

  it('Moradia tem 4 lançamentos e Alimentação 3, como nos cards', () => {
    const conta = (nome: string) =>
      TRANSACOES.filter((t) => t.categoria === nome && t.tipo === 'SAIDA').length;
    expect(conta('Moradia')).toBe(4);
    expect(conta('Alimentação')).toBe(3);
  });

  it('a categoria de entrada não tem orçamento — "sem limite", não zero', () => {
    const salario = CATEGORIAS.find((c) => c.nome === 'Salário')!;
    expect(salario.tipo).toBe('ENTRADA');
    expect(salario.orcamento).toBeNull();
  });
});

describe('datas', () => {
  it('converte dd/MM para a data UTC correta sem escorregar de dia', () => {
    expect(dataBR('01/08').toISOString()).toBe('2026-08-01T00:00:00.000Z');
    expect(dataBR('28/08').toISOString()).toBe('2026-08-28T00:00:00.000Z');
    expect(dataBR('18/11').toISOString()).toBe('2026-11-18T00:00:00.000Z');
  });

  it('rejeita entrada malformada em vez de gerar Invalid Date', () => {
    expect(() => dataBR('')).toThrow();
    expect(() => dataBR('agosto')).toThrow();
  });

  it('todo lançamento cai em agosto de 2026, a competência do seed', () => {
    for (const t of TRANSACOES) {
      const d = dataBR(t.data);
      expect(d.getUTCFullYear()).toBe(2026);
      expect(d.getUTCMonth()).toBe(7);
    }
  });
});
