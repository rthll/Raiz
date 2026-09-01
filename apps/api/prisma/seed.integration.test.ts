/**
 * Confere o que o seed realmente gravou no Postgres.
 *
 * `seed-data.test.ts` valida o dataset em memória; este arquivo valida a viagem
 * de ida e volta pelo banco — tipos Decimal, relações, constraints e as agregações
 * que a API vai usar nas telas.
 *
 * Pula sozinho quando não há banco alcançável, para não quebrar um `pnpm test`
 * em máquina sem Postgres nem em CI sem serviço.
 */
import { PrismaClient } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';
import { budgetUsage, formatBRL, formatPercent } from '@raiz/core';
import { verifyPassword } from '../src/auth/password.js';
import { USERS } from './seed-data.js';

const prisma = new PrismaClient();

const bancoDisponivel = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false);

const seedAplicado =
  bancoDisponivel && (await prisma.household.count().catch(() => 0)) > 0;

afterAll(async () => {
  await prisma.$disconnect();
});

const suite = seedAplicado ? describe : describe.skip;

/**
 * As contagens são escopadas ao household do seed: outros testes criam casas
 * temporárias no mesmo banco, e um count() global quebraria conforme a ordem
 * de execução.
 */
const householdDoSeed = await prisma.household
  .findFirst({ where: { nome: 'Casa da Ana e do Bruno' } })
  .catch(() => null);
const escopo = { householdId: householdDoSeed?.id ?? '' };

/**
 * Guarda de sanidade do seed.
 *
 * Estes testes conferem números exatos contra o household do seed. Se alguém
 * mexer nesse household — importar um extrato à mão, criar um lançamento pela
 * tela — as asserções quebram com um diff incompreensível. Este guarda troca
 * isso por uma instrução acionável.
 */
const SEED_ESPERADO = 17;
const lancamentosDoSeed = householdDoSeed
  ? await prisma.transaction.count({ where: { householdId: householdDoSeed.id } })
  : 0;

if (seedAplicado && lancamentosDoSeed !== SEED_ESPERADO) {
  throw new Error(
    `O household do seed tem ${lancamentosDoSeed} lançamentos, esperado ${SEED_ESPERADO}. ` +
      'Alguém alterou os dados do seed — importação manual, lançamento criado pela tela. ' +
      'Rode: pnpm --filter @raiz/api db:seed',
  );
}


if (!seedAplicado) {
  console.warn(
    '\n[seed.integration] pulado: sem banco alcançável ou seed não aplicado.' +
      '\n  Rode: pnpm --filter @raiz/api db:migrate && pnpm --filter @raiz/api db:seed\n',
  );
}

const brl = (v: unknown) => formatBRL(Number(v));

suite('seed no banco', () => {
  it('grava exatamente um household do seed, sem duplicar ao rodar de novo', async () => {
    expect(
      await prisma.household.count({ where: { nome: 'Casa da Ana e do Bruno' } }),
    ).toBe(1);
  });

  it('grava a contagem certa de cada entidade', async () => {
    expect({
      users: await prisma.user.count({ where: escopo }),
      accounts: await prisma.account.count({ where: escopo }),
      cards: await prisma.card.count({ where: escopo }),
      categories: await prisma.category.count({ where: escopo }),
      transactions: await prisma.transaction.count({ where: escopo }),
      subscriptions: await prisma.subscription.count({ where: escopo }),
      assets: await prisma.asset.count({ where: escopo }),
      goals: await prisma.goal.count({ where: escopo }),
      rules: await prisma.rule.count({ where: escopo }),
      imports: await prisma.import.count({ where: escopo }),
      invoices: await prisma.invoice.count({ where: { card: escopo } }),
    }).toEqual({
      users: 2,
      accounts: 3,
      cards: 3,
      categories: 8,
      transactions: 17,
      subscriptions: 8,
      assets: 6,
      goals: 4,
      rules: 4,
      imports: 3,
      invoices: 3,
    });
  });
});

suite('KPIs agregados no banco', () => {
  it('entradas, saídas, saldo e investido batem com os screenshots', async () => {
    const entradas = await prisma.transaction.aggregate({
      _sum: { valor: true },
      where: { ...escopo, tipo: 'ENTRADA' },
    });
    const saidas = await prisma.transaction.aggregate({
      _sum: { valor: true },
      where: { ...escopo, tipo: 'SAIDA' },
    });
    const saldo = await prisma.account.aggregate({ _sum: { saldo: true }, where: escopo });
    const investido = await prisma.asset.aggregate({ _sum: { valor: true }, where: escopo });

    expect(brl(entradas._sum.valor)).toBe('R$ 14.400,00');
    expect(brl(saidas._sum.valor)).toBe('R$ 7.783,70');
    expect(brl(saldo._sum.saldo)).toBe('R$ 21.881,25');
    expect(brl(investido._sum.valor)).toBe('R$ 142.800,00');
  });

  it('Decimal sobrevive à ida e volta sem erro de centavo', async () => {
    // 612,40 em float64 é 612.4000000000000909…; em Decimal(12,2) tem de voltar exato.
    const t = await prisma.transaction.findFirst({
      where: { ...escopo, descricao: 'Supermercado Vila' },
    });
    expect(t!.valor.toString()).toBe('612.4');
    expect(brl(t!.valor)).toBe('R$ 612,40');
  });
});

suite('faturas derivadas dos lançamentos', () => {
  it('a soma dos lançamentos de cada cartão bate com o total materializado', async () => {
    const cards = await prisma.card.findMany({ where: escopo, orderBy: { ordem: 'asc' } });
    const totais: Record<string, string> = {};

    for (const card of cards) {
      const agg = await prisma.transaction.aggregate({
        _sum: { valor: true },
        where: { cardId: card.id },
      });
      const somaDosLancamentos = Number(agg._sum.valor ?? 0);
      const invoice = await prisma.invoice.findFirst({
        where: { cardId: card.id, competencia: '2026-08' },
      });
      // O Invoice.total é cache; a soma é a fonte da verdade. Não podem divergir.
      expect(Number(invoice!.total)).toBeCloseTo(somaDosLancamentos, 2);
      totais[card.nome] = formatBRL(somaDosLancamentos);
    }

    expect(totais).toEqual({
      'Nubank Ultravioleta': 'R$ 1.910,20',
      'Itaú Click': 'R$ 702,80',
      'Inter Gold': 'R$ 0,00',
    });
  });
});

suite('constraints do schema', () => {
  it('nenhum lançamento tem conta e cartão ao mesmo tempo, nem fica sem os dois', async () => {
    const ambos = await prisma.transaction.count({
      where: { ...escopo, AND: [{ accountId: { not: null } }, { cardId: { not: null } }] },
    });
    const nenhum = await prisma.transaction.count({
      where: { ...escopo, accountId: null, cardId: null },
    });
    expect({ ambos, nenhum }).toEqual({ ambos: 0, nenhum: 0 });
  });

  it('todo lançamento tem fingerprint, e todos são únicos', async () => {
    const linhas = await prisma.transaction.findMany({
      where: escopo,
      select: { fingerprint: true },
    });
    expect(linhas.every((t) => !!t.fingerprint)).toBe(true);
    expect(new Set(linhas.map((t) => t.fingerprint)).size).toBe(linhas.length);
  });

  it('a categoria de entrada fica com orçamento nulo, não zero', async () => {
    const salario = await prisma.category.findFirst({ where: { ...escopo, nome: 'Salário' } });
    expect(salario!.tipo).toBe('ENTRADA');
    expect(salario!.orcamentoMensal).toBeNull();
  });

  it('o primeiro cartão é o escuro, e só ele', async () => {
    const escuros = await prisma.card.findMany({ where: { ...escopo, temaEscuro: true } });
    expect(escuros).toHaveLength(1);
    expect(escuros[0]!.nome).toBe('Nubank Ultravioleta');
  });
});

suite('orçamento estourado', () => {
  it('Moradia chega a 183% do limite — o caso que a UI precisa pintar', async () => {
    const moradia = await prisma.category.findFirst({ where: { ...escopo, nome: 'Moradia' } });
    const agg = await prisma.transaction.aggregate({
      _sum: { valor: true },
      where: { categoriaId: moradia!.id, tipo: 'SAIDA' },
    });
    const uso = budgetUsage(Number(agg._sum.valor), Number(moradia!.orcamentoMensal));
    expect(formatBRL(uso.gasto)).toBe('R$ 4.769,90');
    expect(formatPercent(uso.pct)).toBe('183%');
    expect(uso.estourou).toBe(true);
  });
});

suite('usuários e senha', () => {
  it('aceita a senha do seed e rejeita qualquer outra', async () => {
    const ana = await prisma.user.findUnique({ where: { email: USERS[0].email } });
    expect(ana).not.toBeNull();
    expect(await verifyPassword(USERS[0].senha, ana!.senhaHash)).toBe(true);
    expect(await verifyPassword('senha errada', ana!.senhaHash)).toBe(false);
  });

  it('não guarda a senha em texto puro em lugar nenhum', async () => {
    const ana = await prisma.user.findUnique({ where: { email: USERS[0].email } });
    expect(ana!.senhaHash).not.toContain(USERS[0].senha);
    expect(ana!.senhaHash.startsWith('scrypt$')).toBe(true);
  });

  it('os dois usuários pertencem ao mesmo household', async () => {
    const users = await prisma.user.findMany({ where: escopo });
    expect(new Set(users.map((u) => u.householdId)).size).toBe(1);
  });

  it('guarda as três flags de preferência', async () => {
    const ana = await prisma.user.findUnique({ where: { email: USERS[0].email } });
    expect(ana!.preferencias).toEqual({
      modoPrivacidade: false,
      modoCasal: true,
      alertasVencimento: true,
    });
  });
});
