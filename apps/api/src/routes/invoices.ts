import type { PrismaClient } from '@prisma/client';
import { monthlyCost, type SubscriptionPeriod } from '@raiz/core';
import { competencia as competenciaSchema } from '@raiz/schemas';
import type { FastifyInstance } from 'fastify';
import { cartaoDTO, lancamentoDTO } from '../http/dto.js';
import { validar } from '../http/errors.js';
import { competenciaDe, exigirEncontrado, intervaloDoMes } from '../http/scope.js';

interface Deps {
  prisma: PrismaClient;
}

export async function invoiceRoutes(app: FastifyInstance, { prisma }: Deps) {
  app.addHook('preHandler', app.autenticar);

  /**
   * Fatura de um cartão em uma competência.
   *
   * O total é **sempre** somado dos lançamentos. A linha em `Invoice` guarda só
   * o estado de pagamento; se ela existir, seu `total` é sincronizado com a soma,
   * nunca o contrário.
   */
  app.get<{ Params: { id: string }; Querystring: { mes?: string } }>(
    '/api/cards/:id/invoice',
    async (request) => {
      const mes = validar(competenciaSchema, request.query.mes ?? competenciaDe(new Date()));
      const { inicio, fim } = intervaloDoMes(mes);

      const cartao = exigirEncontrado(
        await prisma.card.findFirst({
          where: { id: request.params.id, householdId: request.householdId },
        }),
        'Cartão',
      );

      const itens = await prisma.transaction.findMany({
        where: { cardId: cartao.id, data: { gte: inicio, lt: fim } },
        orderBy: { data: 'asc' },
      });
      const total = itens.reduce((acc, t) => acc + Number(t.valor), 0);

      const registro = await prisma.invoice.findUnique({
        where: { cardId_competencia: { cardId: cartao.id, competencia: mes } },
      });

      // Assinaturas ativas que debitam neste cartão — a nota no rodapé da fatura.
      const assinaturas = await prisma.subscription.findMany({
        where: { cardId: cartao.id, status: { not: 'PAUSADA' } },
      });
      const custoAssinaturas = assinaturas.reduce(
        (acc, a) =>
          acc + monthlyCost({ valor: Number(a.valor), periodo: a.periodo as SubscriptionPeriod }),
        0,
      );

      const [ano, mesNum] = mes.split('-').map(Number);
      const diaValido = (dia: number, ano: number, mes: number) =>
        Math.min(dia, new Date(Date.UTC(ano, mes, 0)).getUTCDate());

      return {
        cartao: cartaoDTO(cartao),
        competencia: mes,
        // O vencimento cai no mês seguinte ao fechamento, como no protótipo.
        fechamento: new Date(
          Date.UTC(ano!, mesNum! - 1, diaValido(cartao.diaFechamento, ano!, mesNum!)),
        )
          .toISOString()
          .slice(0, 10),
        vencimento: new Date(
          Date.UTC(ano!, mesNum!, diaValido(cartao.diaVencimento, ano!, mesNum! + 1)),
        )
          .toISOString()
          .slice(0, 10),
        total,
        limite: Number(cartao.limite),
        usoDoLimite: Number(cartao.limite) > 0 ? (total / Number(cartao.limite)) * 100 : 0,
        paga: registro?.paga ?? false,
        pagaEm: registro?.pagaEm?.toISOString() ?? null,
        itens: itens.map(lancamentoDTO),
        assinaturasVinculadas: {
          quantidade: assinaturas.length,
          custoMensal: custoAssinaturas,
        },
        parcelasEmAndamento: itens.filter((t) => t.parcelaTotal != null).length,
      };
    },
  );

  /** Alterna "paga" / "não paga". Materializa a fatura na primeira vez. */
  app.post<{ Params: { id: string; mes: string } }>(
    '/api/cards/:id/invoice/:mes/pay',
    async (request) => {
      const mes = validar(competenciaSchema, request.params.mes);
      const { inicio, fim } = intervaloDoMes(mes);

      const cartao = exigirEncontrado(
        await prisma.card.findFirst({
          where: { id: request.params.id, householdId: request.householdId },
        }),
        'Cartão',
      );

      const itens = await prisma.transaction.findMany({
        where: { cardId: cartao.id, data: { gte: inicio, lt: fim } },
      });
      const total = itens.reduce((acc, t) => acc + Number(t.valor), 0);

      const existente = await prisma.invoice.findUnique({
        where: { cardId_competencia: { cardId: cartao.id, competencia: mes } },
      });
      const paga = !(existente?.paga ?? false);

      const [ano, mesNum] = mes.split('-').map(Number);
      const registro = await prisma.invoice.upsert({
        where: { cardId_competencia: { cardId: cartao.id, competencia: mes } },
        create: {
          cardId: cartao.id,
          competencia: mes,
          fechamento: new Date(Date.UTC(ano!, mesNum! - 1, Math.min(cartao.diaFechamento, 28))),
          vencimento: new Date(Date.UTC(ano!, mesNum!, Math.min(cartao.diaVencimento, 28))),
          total,
          paga,
          pagaEm: paga ? new Date() : null,
        },
        // O total é re-sincronizado com a soma a cada toque — nunca fica velho.
        update: { paga, pagaEm: paga ? new Date() : null, total },
      });

      return { competencia: mes, paga: registro.paga, total: Number(registro.total) };
    },
  );
}
