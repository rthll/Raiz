import type { PrismaClient } from '@prisma/client';
import { monthlyCost, subscriptionsSummary, type SubscriptionPeriod } from '@raiz/core';
import { assinaturaSchema } from '@raiz/schemas';
import type { FastifyInstance } from 'fastify';
import { assinaturaDTO } from '../http/dto.js';
import { validar } from '../http/errors.js';
import { exigirAfetado, exigirEncontrado, intervaloDoMes } from '../http/scope.js';

interface Deps {
  prisma: PrismaClient;
}

interface Params {
  id: string;
}

export async function subscriptionRoutes(app: FastifyInstance, { prisma }: Deps) {
  app.addHook('preHandler', app.autenticar);

  app.get('/api/subscriptions', async (request) => {
    const assinaturas = await prisma.subscription.findMany({
      where: { householdId: request.householdId },
      orderBy: { nome: 'asc' },
    });
    return assinaturas.map(assinaturaDTO);
  });

  /**
   * KPIs da tela de assinaturas. O custo mensal vem de `@raiz/core` — a mesma
   * função que o frontend usa — então os dois nunca discordam.
   */
  app.get<{ Querystring: { mes?: string } }>('/api/subscriptions/summary', async (request) => {
    const mes = request.query.mes;
    const assinaturas = await prisma.subscription.findMany({
      where: { householdId: request.householdId },
    });

    // A renda do mês é o divisor do KPI "% da renda".
    const where = mes
      ? (() => {
          const { inicio, fim } = intervaloDoMes(mes);
          return {
            householdId: request.householdId,
            tipo: 'ENTRADA' as const,
            data: { gte: inicio, lt: fim },
          };
        })()
      : { householdId: request.householdId, tipo: 'ENTRADA' as const };

    const renda = await prisma.transaction.aggregate({ _sum: { valor: true }, where });

    const lista = assinaturas.map((a) => ({
      valor: Number(a.valor),
      periodo: a.periodo as SubscriptionPeriod,
      status: a.status,
    }));

    const resumo = subscriptionsSummary(lista, Number(renda._sum.valor ?? 0));

    // "A mais cara por mês é X" — considerando o valor já mensalizado, não o cobrado.
    const maisCara = assinaturas
      .filter((a) => a.status !== 'PAUSADA')
      .map((a) => ({
        nome: a.nome,
        mensal: monthlyCost({ valor: Number(a.valor), periodo: a.periodo as SubscriptionPeriod }),
      }))
      .sort((a, b) => b.mensal - a.mensal)[0];

    return { ...resumo, maisCara: maisCara ?? null };
  });

  app.post('/api/subscriptions', async (request, reply) => {
    const dados = validar(assinaturaSchema, request.body);
    await validarVinculos(request.householdId, dados);

    const criada = await prisma.subscription.create({
      data: {
        householdId: request.householdId,
        nome: dados.nome,
        valor: dados.valor,
        periodo: dados.periodo,
        proximoDebito: new Date(`${dados.proximoDebito}T00:00:00.000Z`),
        cardId: dados.cardId ?? null,
        categoriaId: dados.categoriaId,
        status: dados.status,
        observacao: dados.observacao ?? null,
      },
    });
    return reply.code(201).send(assinaturaDTO(criada));
  });

  app.put<{ Params: Params }>('/api/subscriptions/:id', async (request) => {
    const dados = validar(assinaturaSchema, request.body);
    await validarVinculos(request.householdId, dados);

    const { count } = await prisma.subscription.updateMany({
      where: { id: request.params.id, householdId: request.householdId },
      data: {
        nome: dados.nome,
        valor: dados.valor,
        periodo: dados.periodo,
        proximoDebito: new Date(`${dados.proximoDebito}T00:00:00.000Z`),
        cardId: dados.cardId ?? null,
        categoriaId: dados.categoriaId,
        status: dados.status,
        observacao: dados.observacao ?? null,
      },
    });
    exigirAfetado(count, 'Assinatura');
    const atualizada = await prisma.subscription.findUnique({ where: { id: request.params.id } });
    return assinaturaDTO(exigirEncontrado(atualizada, 'Assinatura'));
  });

  /**
   * Pausar/reativar. Existe como rota própria porque é um clique só na tela e
   * não deve exigir o corpo inteiro da assinatura.
   *
   * Pausar tira o custo dos totais imediatamente — quem garante isso é o
   * `subscriptionsSummary`, que ignora PAUSADA.
   */
  app.post<{ Params: Params }>('/api/subscriptions/:id/toggle', async (request) => {
    const atual = await prisma.subscription.findFirst({
      where: { id: request.params.id, householdId: request.householdId },
    });
    const assinatura = exigirEncontrado(atual, 'Assinatura');

    const atualizada = await prisma.subscription.update({
      where: { id: assinatura.id },
      data: { status: assinatura.status === 'PAUSADA' ? 'ATIVA' : 'PAUSADA' },
    });
    return assinaturaDTO(atualizada);
  });

  app.delete<{ Params: Params }>('/api/subscriptions/:id', async (request, reply) => {
    const { count } = await prisma.subscription.deleteMany({
      where: { id: request.params.id, householdId: request.householdId },
    });
    exigirAfetado(count, 'Assinatura');
    return reply.code(204).send();
  });

  async function validarVinculos(
    householdId: string,
    dados: { categoriaId: string; cardId?: string | null },
  ) {
    const categoria = await prisma.category.findFirst({
      where: { id: dados.categoriaId, householdId },
    });
    exigirEncontrado(categoria, 'Categoria');
    if (dados.cardId) {
      const cartao = await prisma.card.findFirst({ where: { id: dados.cardId, householdId } });
      exigirEncontrado(cartao, 'Cartão');
    }
  }
}
