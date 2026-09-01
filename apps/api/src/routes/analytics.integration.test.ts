/**
 * Os endpoints agregados contra o seed do protótipo.
 *
 * Aqui a régua são os screenshots do handoff: se `/api/dashboard` não devolver
 * os mesmos números que a tela mostra, a Etapa 5 vai construir em cima de dado
 * errado. Loga como a usuária do seed e confere endpoint por endpoint.
 */
import { PrismaClient } from '@prisma/client';
import { formatBRL, formatPercent } from '@raiz/core';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { loadEnv } from '../env.js';

const prisma = new PrismaClient();

const seedAplicado = await prisma.user
  .findUnique({ where: { email: 'ana@raiz.app' } })
  .then((u) => !!u)
  .catch(() => false);

const suite = seedAplicado ? describe : describe.skip;
if (!seedAplicado) {
  console.warn(
    '\n[analytics.integration] pulado: seed não aplicado.' +
      '\n  Rode: pnpm --filter @raiz/api db:seed\n',
  );
}

const env = loadEnv({
  NODE_ENV: 'test',
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: 'a'.repeat(48),
  JWT_REFRESH_SECRET: 'b'.repeat(48),
  CORS_ORIGINS: 'http://localhost:5173',
} as never);

let app: FastifyInstance;
let auth: { authorization: string };

const MES = '2026-08';

beforeAll(async () => {
  if (!seedAplicado) return;
  app = buildApp({ env, logger: false, prisma });
  await app.ready();

  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'ana@raiz.app', senha: 'raiz1234' },
  });
  expect(login.statusCode).toBe(200);
  auth = { authorization: `Bearer ${login.json().accessToken}` };
});

afterAll(async () => {
  await app?.close();
  await prisma.$disconnect();
});

const get = (url: string) => app.inject({ method: 'GET', url, headers: auth });

suite('GET /api/dashboard', () => {
  it('devolve os 4 KPIs da visão geral', async () => {
    const res = await get(`/api/dashboard?mes=${MES}`);
    expect(res.statusCode).toBe(200);
    const { kpis } = res.json();

    expect(formatBRL(kpis.saldoContas)).toBe('R$ 21.881,25');
    expect(formatBRL(kpis.entradas)).toBe('R$ 14.400,00');
    expect(formatBRL(kpis.saidas)).toBe('R$ 7.783,70');
    expect(formatBRL(kpis.patrimonio, { decimals: 0 })).toBe('R$ 164.681');
    expect(formatBRL(kpis.custoAssinaturas)).toBe('R$ 380,10');
    expect(formatBRL(kpis.totalFaturas)).toBe('R$ 2.613,00');
  });

  it('lista as 6 maiores categorias, da maior para a menor', async () => {
    const { gastoPorCategoria } = (await get(`/api/dashboard?mes=${MES}`)).json();
    expect(gastoPorCategoria.length).toBeLessThanOrEqual(6);
    expect(gastoPorCategoria[0].categoria.nome).toBe('Moradia');
    expect(formatBRL(gastoPorCategoria[0].gasto)).toBe('R$ 4.769,90');
    // Ordenação decrescente.
    const gastos = gastoPorCategoria.map((c: { gasto: number }) => c.gasto);
    expect([...gastos].sort((a: number, b: number) => b - a)).toEqual(gastos);
  });

  it('marca o estouro de orçamento da Moradia', async () => {
    const { gastoPorCategoria } = (await get(`/api/dashboard?mes=${MES}`)).json();
    const moradia = gastoPorCategoria.find(
      (c: { categoria: { nome: string } }) => c.categoria.nome === 'Moradia',
    );
    expect(moradia.orcamento.estourou).toBe(true);
    expect(formatPercent(moradia.orcamento.pct)).toBe('183%');
  });

  it('traz 3 assinaturas e 2 faturas nos próximos vencimentos', async () => {
    const { vencimentos } = (await get(`/api/dashboard?mes=${MES}`)).json();
    expect(vencimentos.filter((v: { tipo: string }) => v.tipo === 'assinatura')).toHaveLength(3);
    expect(vencimentos.filter((v: { tipo: string }) => v.tipo === 'fatura')).toHaveLength(2);
    // Assinatura anual entra mensalizada, não pelo valor cheio.
    const anual = vencimentos.find((v: { nome: string }) => v.nome === 'Suíte de design');
    if (anual) expect(anual.valor).toBeCloseTo(107.5, 2);
  });

  it('divide o gasto do casal e calcula o acerto', async () => {
    const { divisaoCasal } = (await get(`/api/dashboard?mes=${MES}`)).json();
    expect(divisaoCasal.porResponsavel).toHaveLength(3);
    const soma = divisaoCasal.porResponsavel.reduce(
      (a: number, p: { percentual: number }) => a + p.percentual,
      0,
    );
    expect(soma).toBeCloseTo(100, 6);
    expect(divisaoCasal.acerto).toBeGreaterThanOrEqual(0);
  });

  it('avisa do teste grátis que vai virar cobrança', async () => {
    const { alertas } = (await get(`/api/dashboard?mes=${MES}`)).json();
    expect(alertas.testeGratis.nome).toBe('App de meditação');
    expect(alertas.testeGratis.passaACustar).toBeCloseTo(49.9, 2);
    expect(alertas.faturaFechando.nome).toBe('Nubank Ultravioleta');
    expect(alertas.faturaFechando.dia).toBe(28);
  });

  it('devolve zeros — não erro — para um mês sem lançamento', async () => {
    const res = await get('/api/dashboard?mes=2027-03');
    expect(res.statusCode).toBe(200);
    expect(res.json().kpis.entradas).toBe(0);
    expect(res.json().kpis.saidas).toBe(0);
    // Saldo em contas e patrimônio não dependem do mês.
    expect(formatBRL(res.json().kpis.saldoContas)).toBe('R$ 21.881,25');
  });
});

suite('GET /api/transactions', () => {
  it('lista os 17 lançamentos do mês com o resumo', async () => {
    const res = await get(`/api/transactions?mes=${MES}`);
    expect(res.json().itens).toHaveLength(17);
    expect(res.json().resumo.saldo).toBeCloseTo(14400 - 7783.7, 2);
  });

  it('filtra por tipo', async () => {
    const entradas = await get(`/api/transactions?mes=${MES}&tipo=ENTRADA`);
    expect(entradas.json().itens).toHaveLength(3);
  });

  it('busca por descrição sem diferenciar maiúscula nem acento de caixa', async () => {
    const res = await get(`/api/transactions?mes=${MES}&q=SUPERMERCADO`);
    expect(res.json().itens).toHaveLength(1);
    expect(res.json().itens[0].descricao).toBe('Supermercado Vila');
  });

  it('combina os filtros com AND', async () => {
    const cats = await get('/api/categories');
    const alimentacao = cats
      .json()
      .find((c: { nome: string }) => c.nome === 'Alimentação');

    const res = await get(
      `/api/transactions?mes=${MES}&tipo=SAIDA&categoriaId=${alimentacao.id}&q=feira`,
    );
    expect(res.json().itens).toHaveLength(1);
    expect(res.json().itens[0].descricao).toBe('Feira orgânica');
  });

  it('devolve lista vazia — não erro — quando nada casa', async () => {
    const res = await get(`/api/transactions?mes=${MES}&q=zzzzzz`);
    expect(res.statusCode).toBe(200);
    expect(res.json().itens).toEqual([]);
    expect(res.json().resumo.saldo).toBe(0);
  });
});

suite('GET /api/cards/:id/invoice', () => {
  it('monta a fatura do Nubank Ultravioleta com os 6 lançamentos', async () => {
    const cards = await get('/api/cards');
    const nubank = cards
      .json()
      .find((c: { nome: string }) => c.nome === 'Nubank Ultravioleta');

    const res = await get(`/api/cards/${nubank.id}/invoice?mes=${MES}`);
    expect(res.statusCode).toBe(200);
    const fatura = res.json();

    expect(formatBRL(fatura.total)).toBe('R$ 1.910,20');
    expect(fatura.itens).toHaveLength(6);
    expect(fatura.paga).toBe(false);
    expect(fatura.parcelasEmAndamento).toBe(1);
    expect(fatura.assinaturasVinculadas.quantidade).toBe(4);
    // Fecha em 28/08 e vence em 08/09 — vencimento no mês seguinte.
    expect(fatura.fechamento).toBe('2026-08-28');
    expect(fatura.vencimento).toBe('2026-09-08');
  });

  it('devolve fatura zerada para cartão sem lançamento no mês', async () => {
    const cards = await get('/api/cards');
    const inter = cards.json().find((c: { nome: string }) => c.nome === 'Inter Gold');
    const res = await get(`/api/cards/${inter.id}/invoice?mes=${MES}`);
    expect(res.json().total).toBe(0);
    expect(res.json().itens).toEqual([]);
  });

  it('alterna paga/não paga e mantém o total sincronizado com a soma', async () => {
    const cards = await get('/api/cards');
    const itau = cards.json().find((c: { nome: string }) => c.nome === 'Itaú Click');

    const pagar = await app.inject({
      method: 'POST',
      url: `/api/cards/${itau.id}/invoice/${MES}/pay`,
      headers: auth,
    });
    expect(pagar.json().paga).toBe(true);
    expect(formatBRL(pagar.json().total)).toBe('R$ 702,80');

    const despagar = await app.inject({
      method: 'POST',
      url: `/api/cards/${itau.id}/invoice/${MES}/pay`,
      headers: auth,
    });
    expect(despagar.json().paga).toBe(false);
  });
});

suite('GET /api/subscriptions/summary', () => {
  it('devolve os 4 KPIs da tela de assinaturas', async () => {
    const res = await get(`/api/subscriptions/summary?mes=${MES}`);
    const resumo = res.json();

    expect(formatBRL(resumo.custoMensal)).toBe('R$ 380,10');
    expect(formatBRL(resumo.custoAnual, { decimals: 0 })).toBe('R$ 4.561');
    expect(resumo.ativas).toBe(7);
    expect(resumo.pausadas).toBe(1);
    expect(formatPercent(resumo.pctRenda, 1)).toBe('2,6%');
    expect(resumo.maisCara.nome).toBe('Academia');
  });

  it('pausar tira o custo do total na hora, e reativar devolve', async () => {
    const lista = await get('/api/subscriptions');
    const academia = lista.json().find((s: { nome: string }) => s.nome === 'Academia');

    const antes = (await get(`/api/subscriptions/summary?mes=${MES}`)).json().custoMensal;

    await app.inject({
      method: 'POST',
      url: `/api/subscriptions/${academia.id}/toggle`,
      headers: auth,
    });
    const durante = (await get(`/api/subscriptions/summary?mes=${MES}`)).json().custoMensal;
    expect(antes - durante).toBeCloseTo(129, 2);

    await app.inject({
      method: 'POST',
      url: `/api/subscriptions/${academia.id}/toggle`,
      headers: auth,
    });
    const depois = (await get(`/api/subscriptions/summary?mes=${MES}`)).json().custoMensal;
    expect(depois).toBeCloseTo(antes, 2);
  });
});

suite('POST /api/investments/projection', () => {
  const projetar = (payload: Record<string, number>) =>
    app.inject({ method: 'POST', url: '/api/investments/projection', headers: auth, payload });

  it('reproduz a projeção do protótipo no cenário padrão', async () => {
    const res = await projetar({ anos: 10, ajusteTaxa: 0, aporteExtra: 0 });
    expect(res.statusCode).toBe(200);
    const p = res.json();

    expect(p.total).toBeCloseTo(772500.282037, 3);
    expect(p.totalAportado).toBeCloseTo(142800 + 1700 * 120, 2);
    expect(p.juros).toBeCloseTo(p.total - p.totalAportado, 2);
    expect(p.taxaMediaPonderada).toBeCloseTo(11.010154, 5);
  });

  it('devolve os 5 marcos e a projeção por ativo', async () => {
    const p = (await projetar({ anos: 10, ajusteTaxa: 0, aporteExtra: 0 })).json();
    expect(p.marcos.map((m: { anos: number }) => m.anos)).toEqual([1, 3, 5, 10, 20]);
    expect(p.porAtivo).toHaveLength(6);
    // A soma por ativo fecha com o total.
    const soma = p.porAtivo.reduce((a: number, x: { projetado: number }) => a + x.projetado, 0);
    expect(soma).toBeCloseTo(p.total, 2);
  });

  it('as 5 classes do donut somam o investido', async () => {
    const p = (await projetar({ anos: 10 })).json();
    expect(p.alocacao).toHaveLength(5);
    const soma = p.alocacao.reduce((a: number, x: { valor: number }) => a + x.valor, 0);
    expect(soma).toBe(142800);
  });

  it('responde ao ajuste de taxa e ao aporte extra', async () => {
    const base = (await projetar({ anos: 10 })).json().total;
    const otimista = (await projetar({ anos: 10, ajusteTaxa: 2 })).json().total;
    const comAporte = (await projetar({ anos: 10, aporteExtra: 500 })).json().total;
    expect(otimista).toBeGreaterThan(base);
    expect(comAporte).toBeGreaterThan(base);
  });

  it('recusa prazo fora de 1..30 anos', async () => {
    expect((await projetar({ anos: 0 })).statusCode).toBe(422);
    expect((await projetar({ anos: 50 })).statusCode).toBe(422);
  });
});

suite('GET /api/budgets e /api/reports', () => {
  it('orçamentos: 7 categorias com limite, duas estouradas', async () => {
    const res = await get(`/api/budgets?mes=${MES}`);
    const b = res.json();

    expect(b.itens).toHaveLength(7);
    expect(formatBRL(b.limiteSomado, { decimals: 0 })).toBe('R$ 6.980');

    // Moradia (183%) e Saúde (642,00 + 96,30 = 738,30 de limite 700 = 105%).
    const estourados = b.itens
      .filter((i: { estourou: boolean }) => i.estourou)
      .map((i: { categoria: { nome: string } }) => i.categoria.nome);
    expect(estourados).toEqual(['Moradia', 'Saúde']);
    expect(b.estourados).toBe(2);

    // Ordenado pelo percentual, do maior para o menor.
    const pcts = b.itens.map((i: { pct: number }) => i.pct);
    expect([...pcts].sort((a: number, x: number) => x - a)).toEqual(pcts);
  });

  it('orçamentos: os percentuais de cada categoria', async () => {
    const b = (await get(`/api/budgets?mes=${MES}`)).json();
    const pct = Object.fromEntries(
      b.itens.map((i: { categoria: { nome: string }; pct: number }) => [
        i.categoria.nome,
        formatPercent(i.pct),
      ]),
    );
    expect(pct).toEqual({
      Moradia: '183%',
      Saúde: '105%',
      Educação: '88%',
      Transporte: '65%',
      Alimentação: '63%',
      Assinaturas: '61%',
      Lazer: '36%',
    });
  });

  it('relatórios: taxa de poupança, custo fixo e variável, meses de reserva', async () => {
    const res = await get(`/api/reports?mes=${MES}`);
    const r = res.json();

    expect(formatPercent(r.kpis.taxaPoupanca)).toBe('46%');
    expect(r.kpis.custoFixo).toBeGreaterThan(0);
    expect(r.kpis.custoVariavel).toBeGreaterThan(0);
    // A reserva de emergência do seed é 18.400.
    expect(r.kpis.reserva).toBe(18400);
    expect(r.kpis.mesesDeReserva).toBeCloseTo(18400 / 7783.7, 4);
  });

  it('metas: progresso e quanto guardar por mês', async () => {
    const metas = (await get('/api/goals/progress')).json();

    // Screenshot 07: "4 metas ativas · R$ 70.350 de R$ 189.000 acumulados".
    expect(metas).toHaveLength(4);
    const acumulado = metas.reduce((a: number, m: { atual: number }) => a + m.atual, 0);
    const alvoTotal = metas.reduce((a: number, m: { alvo: number }) => a + m.alvo, 0);
    expect(formatBRL(acumulado, { decimals: 0 })).toBe('R$ 70.350');
    expect(formatBRL(alvoTotal, { decimals: 0 })).toBe('R$ 189.000');

    const reserva = metas.find((m: { nome: string }) => m.nome === 'Reserva de emergência');
    expect(formatPercent(reserva.progresso)).toBe('61%');
    // "Guardar R$ 967 por mês para chegar em 12 meses".
    expect(formatBRL(reserva.guardarPorMes, { decimals: 0 })).toBe('R$ 967');
    expect(reserva.atingida).toBe(false);

    const japao = metas.find((m: { nome: string }) => m.nome === 'Viagem ao Japão');
    expect(formatPercent(japao.progresso)).toBe('30%');
    expect(formatBRL(japao.guardarPorMes, { decimals: 0 })).toBe('R$ 931');
  });
});

suite('GET /api/cashflow', () => {
  it('devolve 8 meses terminando na competência pedida', async () => {
    const res = await get(`/api/cashflow?ate=${MES}&meses=8`);
    const { meses } = res.json();
    expect(meses).toHaveLength(8);
    expect(meses[7].mes).toBe('2026-08');
    expect(meses[0].mes).toBe('2026-01');
    // Só agosto tem lançamento no seed; os outros vêm zerados, não ausentes.
    expect(meses[7].entradas).toBeCloseTo(14400, 2);
    expect(meses[0].entradas).toBe(0);
  });
});
