import type { Prisma, PrismaClient } from '@prisma/client';
import { transactionFingerprint } from '@raiz/core';
import { filtroLancamentos, lancamentoSchema } from '@raiz/schemas';
import type { FastifyInstance } from 'fastify';
import { lancamentoDTO } from '../http/dto.js';
import { conflito, validar } from '../http/errors.js';
import { exigirAfetado, exigirEncontrado, intervaloDoMes } from '../http/scope.js';

interface Deps {
  prisma: PrismaClient;
}

interface Params {
  id: string;
}

export async function transactionRoutes(app: FastifyInstance, { prisma }: Deps) {
  app.addHook('preHandler', app.autenticar);

  /**
   * Confere que categoria, conta e cartão informados pertencem ao household.
   * Sem isto, um id de outro household passaria pela FK do banco sem reclamar.
   */
  const validarVinculos = async (
    householdId: string,
    dados: { categoriaId: string; accountId?: string | null; cardId?: string | null },
  ) => {
    const categoria = await prisma.category.findFirst({
      where: { id: dados.categoriaId, householdId },
    });
    exigirEncontrado(categoria, 'Categoria');

    if (dados.accountId) {
      const conta = await prisma.account.findFirst({
        where: { id: dados.accountId, householdId },
      });
      exigirEncontrado(conta, 'Conta');
    }
    if (dados.cardId) {
      const cartao = await prisma.card.findFirst({ where: { id: dados.cardId, householdId } });
      exigirEncontrado(cartao, 'Cartão');
    }
    return categoria!;
  };

  // ── listagem com os filtros da tela de lançamentos
  app.get('/api/transactions', async (request) => {
    const filtro = validar(filtroLancamentos, request.query);

    const where: Prisma.TransactionWhereInput = { householdId: request.householdId };

    if (filtro.mes) {
      const { inicio, fim } = intervaloDoMes(filtro.mes);
      where.data = { gte: inicio, lt: fim };
    }
    if (filtro.tipo !== 'todos') where.tipo = filtro.tipo;
    if (filtro.categoriaId) where.categoriaId = filtro.categoriaId;
    if (filtro.cardId) where.cardId = filtro.cardId;
    if (filtro.accountId) where.accountId = filtro.accountId;
    // Busca por descrição, sem diferenciar maiúscula de minúscula — os três
    // filtros se combinam com AND, como o handoff pede.
    if (filtro.q) where.descricao = { contains: filtro.q, mode: 'insensitive' };

    const [itens, totalNoMes] = await Promise.all([
      prisma.transaction.findMany({ where, orderBy: [{ data: 'asc' }, { criadoEm: 'asc' }] }),
      prisma.transaction.count({
        where: filtro.mes
          ? { householdId: request.householdId, data: where.data }
          : { householdId: request.householdId },
      }),
    ]);

    const soma = (tipo: 'ENTRADA' | 'SAIDA') =>
      itens.filter((t) => t.tipo === tipo).reduce((acc, t) => acc + Number(t.valor), 0);

    const entradas = soma('ENTRADA');
    const saidas = soma('SAIDA');

    return {
      itens: itens.map(lancamentoDTO),
      // Alimenta o resumo "N de M lançamentos · saldo do mês R$ X".
      resumo: {
        exibidos: itens.length,
        total: totalNoMes,
        entradas,
        saidas,
        saldo: entradas - saidas,
      },
    };
  });

  app.get<{ Params: Params }>('/api/transactions/:id', async (request) => {
    const item = await prisma.transaction.findFirst({
      where: { id: request.params.id, householdId: request.householdId },
    });
    return lancamentoDTO(exigirEncontrado(item, 'Lançamento'));
  });

  app.post('/api/transactions', async (request, reply) => {
    const dados = validar(lancamentoSchema, request.body);
    await validarVinculos(request.householdId, dados);

    const data = new Date(`${dados.data}T00:00:00.000Z`);
    const criado = await prisma.transaction
      .create({
        data: {
          householdId: request.householdId,
          data,
          descricao: dados.descricao,
          valor: dados.valor,
          tipo: dados.tipo,
          categoriaId: dados.categoriaId,
          accountId: dados.accountId ?? null,
          cardId: dados.cardId ?? null,
          responsavel: dados.responsavel,
          parcelaAtual: dados.parcelaAtual ?? null,
          parcelaTotal: dados.parcelaTotal ?? null,
          fingerprint: transactionFingerprint({
            data: dados.data,
            valor: dados.valor,
            descricao: dados.descricao,
            accountId: dados.accountId ?? dados.cardId!,
          }),
        },
      })
      .catch(() => {
        // O unique de fingerprint é o mesmo mecanismo que protege a importação.
        throw conflito('Esse lançamento já existe — mesma data, valor e descrição.');
      });

    return reply.code(201).send(lancamentoDTO(criado));
  });

  app.put<{ Params: Params }>('/api/transactions/:id', async (request) => {
    const dados = validar(lancamentoSchema, request.body);
    await validarVinculos(request.householdId, dados);

    const data = new Date(`${dados.data}T00:00:00.000Z`);
    const { count } = await prisma.transaction.updateMany({
      where: { id: request.params.id, householdId: request.householdId },
      data: {
        data,
        descricao: dados.descricao,
        valor: dados.valor,
        tipo: dados.tipo,
        categoriaId: dados.categoriaId,
        accountId: dados.accountId ?? null,
        cardId: dados.cardId ?? null,
        responsavel: dados.responsavel,
        parcelaAtual: dados.parcelaAtual ?? null,
        parcelaTotal: dados.parcelaTotal ?? null,
        // O fingerprint acompanha os campos que o compõem, senão a próxima
        // importação recriaria o lançamento como se fosse novo.
        fingerprint: transactionFingerprint({
          data: dados.data,
          valor: dados.valor,
          descricao: dados.descricao,
          accountId: dados.accountId ?? dados.cardId!,
        }),
      },
    });
    exigirAfetado(count, 'Lançamento');

    const atualizado = await prisma.transaction.findUnique({ where: { id: request.params.id } });
    return lancamentoDTO(exigirEncontrado(atualizado, 'Lançamento'));
  });

  app.delete<{ Params: Params }>('/api/transactions/:id', async (request, reply) => {
    const { count } = await prisma.transaction.deleteMany({
      where: { id: request.params.id, householdId: request.householdId },
    });
    exigirAfetado(count, 'Lançamento');
    return reply.code(204).send();
  });
}
