/**
 * Popula o banco com o dataset do protótipo.
 *
 * Idempotente: apaga o household do seed e recria tudo. Rodar duas vezes deixa o
 * banco no mesmo estado — nunca duplicado.
 *
 *   pnpm --filter @raiz/api db:seed
 */
import { PrismaClient, type Prisma } from '@prisma/client';
import { transactionFingerprint } from '@raiz/core';
import { hashPassword } from '../src/auth/password.js';
import {
  ASSINATURAS,
  ATIVOS,
  CARTOES,
  CATEGORIAS,
  CONTAS,
  HOUSEHOLD,
  IMPORTACOES,
  METAS,
  PREFERENCIAS_PADRAO,
  REGRAS,
  TRANSACOES,
  USERS,
  dataBR,
} from './seed-data.js';

const prisma = new PrismaClient();

/** `'ontem'`, `'há 3 dias'`, `'há 1 semana'` → uma data concreta antes de hoje. */
function syncParaData(sync: string, referencia: Date): Date {
  const dias = sync === 'ontem' ? 1 : sync === 'há 3 dias' ? 3 : 7;
  return new Date(referencia.getTime() - dias * 24 * 60 * 60 * 1000);
}

async function main() {
  const referencia = dataBR('29/08');

  // ── limpa o household do seed, se já existir
  const existente = await prisma.household.findFirst({ where: { nome: HOUSEHOLD.nome } });
  if (existente) {
    // O cascade do schema cuida de tudo que pende do household.
    await prisma.household.delete({ where: { id: existente.id } });
    console.log('· household anterior removido');
  }

  const household = await prisma.household.create({ data: { nome: HOUSEHOLD.nome } });
  console.log(`· household "${household.nome}"`);

  // ── usuários
  for (const u of USERS) {
    await prisma.user.create({
      data: {
        email: u.email,
        nome: u.nome,
        senhaHash: await hashPassword(u.senha),
        householdId: household.id,
        preferencias: PREFERENCIAS_PADRAO as Prisma.InputJsonValue,
      },
    });
  }
  console.log(`· ${USERS.length} usuários`);

  // ── contas
  const contaPorNome = new Map<string, string>();
  for (const c of CONTAS) {
    const criada = await prisma.account.create({
      data: {
        householdId: household.id,
        nome: c.nome,
        tipo: c.tipo,
        dono: c.dono,
        saldo: c.saldo,
        ultimaSync: syncParaData(c.sync, referencia),
      },
    });
    contaPorNome.set(c.nome, criada.id);
  }
  console.log(`· ${CONTAS.length} contas`);

  // ── cartões
  const cartaoPorNome = new Map<string, string>();
  for (const [i, c] of CARTOES.entries()) {
    const criado = await prisma.card.create({
      data: {
        householdId: household.id,
        nome: c.nome,
        bandeira: c.bandeira,
        final: c.final,
        limite: c.limite,
        diaFechamento: c.diaFechamento,
        diaVencimento: c.diaVencimento,
        temaEscuro: c.temaEscuro,
        ordem: i,
      },
    });
    cartaoPorNome.set(c.nome, criado.id);
  }
  console.log(`· ${CARTOES.length} cartões`);

  // ── categorias
  const categoriaPorNome = new Map<string, string>();
  for (const [i, k] of CATEGORIAS.entries()) {
    const criada = await prisma.category.create({
      data: {
        householdId: household.id,
        nome: k.nome,
        tipo: k.tipo,
        cor: k.cor,
        orcamentoMensal: k.orcamento,
        ordem: i,
      },
    });
    categoriaPorNome.set(k.nome, criada.id);
  }
  console.log(`· ${CATEGORIAS.length} categorias`);

  // ── lançamentos
  for (const t of TRANSACOES) {
    const accountId = 'conta' in t.origem ? contaPorNome.get(t.origem.conta)! : null;
    const cardId = 'cartao' in t.origem ? cartaoPorNome.get(t.origem.cartao)! : null;
    const data = dataBR(t.data);

    await prisma.transaction.create({
      data: {
        householdId: household.id,
        data,
        descricao: t.descricao,
        valor: t.valor,
        tipo: t.tipo,
        categoriaId: categoriaPorNome.get(t.categoria)!,
        accountId,
        cardId,
        responsavel: t.responsavel,
        parcelaAtual: t.parcela?.atual ?? null,
        parcelaTotal: t.parcela?.total ?? null,
        fingerprint: transactionFingerprint({
          data: data.toISOString().slice(0, 10),
          valor: t.valor,
          descricao: t.descricao,
          accountId: accountId ?? cardId!,
        }),
      },
    });
  }
  console.log(`· ${TRANSACOES.length} lançamentos`);

  // ── assinaturas
  for (const a of ASSINATURAS) {
    await prisma.subscription.create({
      data: {
        householdId: household.id,
        nome: a.nome,
        valor: a.valor,
        periodo: a.periodo,
        proximoDebito: dataBR(a.proximo),
        cardId: cartaoPorNome.get(a.cartao)!,
        categoriaId: categoriaPorNome.get(a.categoria)!,
        status: a.status,
        observacao: a.observacao,
        precoAnterior: 'precoAnterior' in a ? a.precoAnterior : null,
      },
    });
  }
  console.log(`· ${ASSINATURAS.length} assinaturas`);

  // ── ativos
  for (const [i, a] of ATIVOS.entries()) {
    await prisma.asset.create({
      data: {
        householdId: household.id,
        nome: a.nome,
        classe: a.classe,
        valor: a.valor,
        taxaAnual: a.taxaAnual,
        aporteMensal: a.aporteMensal,
        metaTaxa: a.metaTaxa,
        ordem: i,
      },
    });
  }
  console.log(`· ${ATIVOS.length} ativos`);

  // ── metas
  for (const [i, m] of METAS.entries()) {
    await prisma.goal.create({
      data: {
        householdId: household.id,
        nome: m.nome,
        alvo: m.alvo,
        atual: m.atual,
        prazoMeses: m.prazoMeses,
        ordem: i,
      },
    });
  }
  console.log(`· ${METAS.length} metas`);

  // ── regras de classificação
  for (const [i, r] of REGRAS.entries()) {
    await prisma.rule.create({
      data: {
        householdId: household.id,
        termo: r.termo,
        categoriaId: categoriaPorNome.get(r.categoria)!,
        acertos: r.acertos,
        ordem: i,
      },
    });
  }
  console.log(`· ${REGRAS.length} regras`);

  // ── histórico de importações
  for (const imp of IMPORTACOES) {
    // O mês já vem no próprio dd/MM — o de julho cai em julho sozinho.
    await prisma.import.create({
      data: {
        householdId: household.id,
        accountId: contaPorNome.get(imp.conta)!,
        arquivo: imp.arquivo,
        periodoInicio: dataBR(imp.inicio),
        periodoFim: dataBR(imp.fim),
        quantidade: imp.quantidade,
        classificados: imp.classificados,
      },
    });
  }
  console.log(`· ${IMPORTACOES.length} importações`);

  // ── faturas abertas, derivadas dos lançamentos de cada cartão
  for (const c of CARTOES) {
    const cardId = cartaoPorNome.get(c.nome)!;
    const itens = await prisma.transaction.findMany({ where: { cardId } });
    const total = itens.reduce((acc, t) => acc + Number(t.valor), 0);
    await prisma.invoice.create({
      data: {
        cardId,
        competencia: '2026-08',
        fechamento: dataBR(`${String(c.diaFechamento).padStart(2, '0')}/08`),
        vencimento: dataBR(`${String(c.diaVencimento).padStart(2, '0')}/09`),
        total,
        paga: false,
      },
    });
  }
  console.log(`· ${CARTOES.length} faturas de agosto`);

  console.log('\nSeed concluído.');
  console.log(`Login: ${USERS[0].email} / ${USERS[0].senha}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
