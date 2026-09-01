import type { PrismaClient } from '@prisma/client';
import {
  budgetUsage,
  coupleSettlement,
  goalMonthlySuggestion,
  goalProgress,
  monthlyCost,
  monthsOfReserve,
  portfolioProjection,
  savingsRate,
  subscriptionsSummary,
  weightedAverageRate,
  type SubscriptionPeriod,
} from '@raiz/core';
import { competencia as competenciaSchema, projecaoSchema } from '@raiz/schemas';
import type { FastifyInstance } from 'fastify';
import { ativoDTO, assinaturaDTO, categoriaDTO, metaDTO } from '../http/dto.js';
import { validar } from '../http/errors.js';
import { competenciaDe, intervaloDoMes } from '../http/scope.js';

interface Deps {
  prisma: PrismaClient;
}

/** Categorias que o handoff classifica como custo fixo e variável nos relatórios. */
const CUSTO_FIXO = ['Moradia', 'Assinaturas', 'Saúde', 'Educação'];
const CUSTO_VARIAVEL = ['Alimentação', 'Lazer', 'Transporte'];

export async function analyticsRoutes(app: FastifyInstance, { prisma }: Deps) {
  app.addHook('preHandler', app.autenticar);

  /** Carrega tudo que as telas agregadas precisam de uma competência. */
  const carregarMes = async (householdId: string, mes: string) => {
    const { inicio, fim } = intervaloDoMes(mes);
    const [transacoes, categorias, contas, cartoes, assinaturas, ativos] = await Promise.all([
      prisma.transaction.findMany({
        where: { householdId, data: { gte: inicio, lt: fim } },
        orderBy: { data: 'asc' },
      }),
      prisma.category.findMany({ where: { householdId }, orderBy: { ordem: 'asc' } }),
      prisma.account.findMany({ where: { householdId } }),
      prisma.card.findMany({ where: { householdId }, orderBy: { ordem: 'asc' } }),
      prisma.subscription.findMany({ where: { householdId } }),
      prisma.asset.findMany({ where: { householdId }, orderBy: { ordem: 'asc' } }),
    ]);
    return { transacoes, categorias, contas, cartoes, assinaturas, ativos, inicio, fim };
  };

  const somaPorTipo = (
    transacoes: Array<{ tipo: string; valor: unknown }>,
    tipo: 'ENTRADA' | 'SAIDA',
  ) =>
    transacoes
      .filter((t) => t.tipo === tipo)
      .reduce((acc, t) => acc + Number(t.valor), 0);

  // ─────────────────────────────────────────────────────────── dashboard

  app.get<{ Querystring: { mes?: string } }>('/api/dashboard', async (request) => {
    const mes = validar(competenciaSchema, request.query.mes ?? competenciaDe(new Date()));
    const { transacoes, categorias, contas, cartoes, assinaturas, ativos } = await carregarMes(
      request.householdId,
      mes,
    );

    const entradas = somaPorTipo(transacoes, 'ENTRADA');
    const saidas = somaPorTipo(transacoes, 'SAIDA');
    const saldoContas = contas.reduce((acc, c) => acc + Number(c.saldo), 0);
    const investido = ativos.reduce((acc, a) => acc + Number(a.valor), 0);

    const resumoAssinaturas = subscriptionsSummary(
      assinaturas.map((a) => ({
        valor: Number(a.valor),
        periodo: a.periodo as SubscriptionPeriod,
        status: a.status,
      })),
      entradas,
    );

    // Gasto por categoria, ordenado — alimenta "Para onde o dinheiro foi".
    const porCategoria = categorias
      .filter((c) => c.tipo === 'SAIDA')
      .map((c) => {
        const itens = transacoes.filter((t) => t.categoriaId === c.id && t.tipo === 'SAIDA');
        const gasto = itens.reduce((acc, t) => acc + Number(t.valor), 0);
        return {
          categoria: categoriaDTO(c),
          gasto,
          quantidade: itens.length,
          orcamento: budgetUsage(gasto, c.orcamentoMensal ? Number(c.orcamentoMensal) : null),
        };
      })
      .sort((a, b) => b.gasto - a.gasto);

    // Faturas abertas por cartão.
    const faturas = cartoes.map((c) => {
      const total = transacoes
        .filter((t) => t.cardId === c.id)
        .reduce((acc, t) => acc + Number(t.valor), 0);
      return {
        cardId: c.id,
        nome: c.nome,
        total,
        limite: Number(c.limite),
        diaVencimento: c.diaVencimento,
        diaFechamento: c.diaFechamento,
      };
    });

    // Próximos vencimentos: 3 assinaturas ativas + 2 faturas, como no protótipo.
    const proximasAssinaturas = assinaturas
      .filter((a) => a.status !== 'PAUSADA')
      .sort((a, b) => a.proximoDebito.getTime() - b.proximoDebito.getTime())
      .slice(0, 3)
      .map((a) => ({
        tipo: 'assinatura' as const,
        nome: a.nome,
        detalhe: `${a.periodo.toLowerCase()} · ${cartoes.find((c) => c.id === a.cardId)?.nome ?? '—'}`,
        valor: monthlyCost({ valor: Number(a.valor), periodo: a.periodo as SubscriptionPeriod }),
        data: a.proximoDebito.toISOString().slice(0, 10),
        destaque: a.status === 'TESTE',
      }));

    const proximasFaturas = faturas.slice(0, 2).map((f) => ({
      tipo: 'fatura' as const,
      nome: `Fatura ${f.nome}`,
      detalhe: `vence dia ${f.diaVencimento}`,
      valor: f.total,
      data: `${mes}-${String(f.diaVencimento).padStart(2, '0')}`,
      destaque: true,
    }));

    // Divisão do casal.
    const porResponsavel = (['ANA', 'BRUNO', 'CONJUNTA'] as const).map((quem) => ({
      responsavel: quem,
      gasto: transacoes
        .filter((t) => t.tipo === 'SAIDA' && t.responsavel === quem)
        .reduce((acc, t) => acc + Number(t.valor), 0),
    }));
    const totalPessoal = porResponsavel.reduce((acc, p) => acc + p.gasto, 0);

    const taxaMedia = weightedAverageRate(
      ativos.map((a) => ({
        valor: Number(a.valor),
        taxa: Number(a.taxaAnual),
        aporteMensal: Number(a.aporteMensal),
      })),
    );

    // Alertas: teste grátis prestes a virar cobrança e fatura fechando.
    const testeGratis = assinaturas.find((a) => a.status === 'TESTE');
    const primeiroCartao = cartoes[0];

    return {
      competencia: mes,
      kpis: {
        saldoContas,
        entradas,
        saidas,
        saldoDoMes: entradas - saidas,
        investido,
        patrimonio: saldoContas + investido,
        custoAssinaturas: resumoAssinaturas.custoMensal,
        totalFaturas: faturas.reduce((acc, f) => acc + f.total, 0),
      },
      gastoPorCategoria: porCategoria.filter((c) => c.gasto > 0).slice(0, 6),
      vencimentos: [...proximasAssinaturas, ...proximasFaturas],
      divisaoCasal: {
        porResponsavel: porResponsavel.map((p) => ({
          ...p,
          percentual: totalPessoal > 0 ? (p.gasto / totalPessoal) * 100 : 0,
        })),
        acerto: coupleSettlement(porResponsavel[0]!.gasto, porResponsavel[1]!.gasto),
      },
      investimentos: {
        total: investido,
        taxaMediaPonderada: taxaMedia,
        aporteMensal: ativos.reduce((acc, a) => acc + Number(a.aporteMensal), 0),
      },
      alertas: {
        testeGratis: testeGratis
          ? {
              nome: testeGratis.nome,
              data: testeGratis.proximoDebito.toISOString().slice(0, 10),
              passaACustar: testeGratis.precoAnterior ? Number(testeGratis.precoAnterior) : null,
            }
          : null,
        faturaFechando: primeiroCartao
          ? { nome: primeiroCartao.nome, dia: primeiroCartao.diaFechamento }
          : null,
      },
    };
  });

  // ────────────────────────────────────────────────────────── orçamentos

  app.get<{ Querystring: { mes?: string } }>('/api/budgets', async (request) => {
    const mes = validar(competenciaSchema, request.query.mes ?? competenciaDe(new Date()));
    const { transacoes, categorias } = await carregarMes(request.householdId, mes);

    const itens = categorias
      .filter((c) => c.orcamentoMensal != null)
      .map((c) => {
        const gasto = transacoes
          .filter((t) => t.categoriaId === c.id && t.tipo === 'SAIDA')
          .reduce((acc, t) => acc + Number(t.valor), 0);
        return {
          categoria: categoriaDTO(c),
          ...budgetUsage(gasto, Number(c.orcamentoMensal)),
        };
      })
      .sort((a, b) => b.pct - a.pct);

    return {
      competencia: mes,
      itens,
      limiteSomado: itens.reduce((acc, i) => acc + i.limite, 0),
      gastoSomado: itens.reduce((acc, i) => acc + i.gasto, 0),
      estourados: itens.filter((i) => i.estourou).length,
    };
  });

  // ──────────────────────────────────────────────────────────── metas

  app.get('/api/goals/progress', async (request) => {
    const metas = await prisma.goal.findMany({
      where: { householdId: request.householdId },
      orderBy: { ordem: 'asc' },
    });
    return metas.map((m) => {
      const alvo = Number(m.alvo);
      const atual = Number(m.atual);
      return {
        ...metaDTO(m),
        progresso: goalProgress(alvo, atual),
        guardarPorMes: goalMonthlySuggestion(alvo, atual, m.prazoMeses),
        atingida: atual >= alvo,
      };
    });
  });

  // ────────────────────────────────────────────────────── investimentos

  /**
   * Simulador de cenários. O cálculo é o mesmo `@raiz/core` que roda no
   * navegador enquanto o usuário arrasta os sliders — este endpoint existe para
   * quem chega pela API e como fonte da verdade.
   */
  app.post('/api/investments/projection', async (request) => {
    const dados = validar(projecaoSchema, request.body ?? {});
    const ativos = await prisma.asset.findMany({
      where: { householdId: request.householdId },
      orderBy: { ordem: 'asc' },
    });

    const entrada = ativos.map((a) => ({
      valor: Number(a.valor),
      taxa: Number(a.taxaAnual),
      aporteMensal: Number(a.aporteMensal),
    }));

    const projecao = portfolioProjection(entrada, dados.anos, {
      ajusteTaxa: dados.ajusteTaxa,
      aporteExtra: dados.aporteExtra,
    });

    return {
      ...projecao,
      porAtivo: projecao.porAtivo.map((p) => ({
        ...ativoDTO(ativos[p.index]!),
        projetado: p.total,
        bateMeta: Number(ativos[p.index]!.taxaAnual) >= Number(ativos[p.index]!.metaTaxa),
      })),
      alocacao: Object.entries(
        ativos.reduce<Record<string, number>>((acc, a) => {
          acc[a.classe] = (acc[a.classe] ?? 0) + Number(a.valor);
          return acc;
        }, {}),
      ).map(([classe, valor]) => ({ classe, valor })),
    };
  });

  // ───────────────────────────────────────────────────────── relatórios

  app.get<{ Querystring: { mes?: string } }>('/api/reports', async (request) => {
    const mes = validar(competenciaSchema, request.query.mes ?? competenciaDe(new Date()));
    const { transacoes, categorias, assinaturas } = await carregarMes(request.householdId, mes);

    const entradas = somaPorTipo(transacoes, 'ENTRADA');
    const saidas = somaPorTipo(transacoes, 'SAIDA');

    const gastoDe = (nomes: string[]) =>
      transacoes
        .filter((t) => {
          const cat = categorias.find((c) => c.id === t.categoriaId);
          return t.tipo === 'SAIDA' && cat && nomes.includes(cat.nome);
        })
        .reduce((acc, t) => acc + Number(t.valor), 0);

    // A reserva é a soma das metas cujo nome indica reserva de emergência.
    const metas = await prisma.goal.findMany({ where: { householdId: request.householdId } });
    const reserva = metas
      .filter((m) => /reserva/i.test(m.nome))
      .reduce((acc, m) => acc + Number(m.atual), 0);

    const maioresCategorias = categorias
      .filter((c) => c.tipo === 'SAIDA')
      .map((c) => ({
        categoria: categoriaDTO(c),
        gasto: transacoes
          .filter((t) => t.categoriaId === c.id && t.tipo === 'SAIDA')
          .reduce((acc, t) => acc + Number(t.valor), 0),
      }))
      .filter((c) => c.gasto > 0)
      .sort((a, b) => b.gasto - a.gasto);

    return {
      competencia: mes,
      kpis: {
        taxaPoupanca: savingsRate(entradas, saidas),
        custoFixo: gastoDe(CUSTO_FIXO),
        custoVariavel: gastoDe(CUSTO_VARIAVEL),
        mesesDeReserva: monthsOfReserve(reserva, saidas),
        reserva,
      },
      maioresCategorias,
      assinaturasAtivas: assinaturas
        .filter((a) => a.status !== 'PAUSADA')
        .map(assinaturaDTO)
        .length,
      entradas,
      saidas,
    };
  });

  // ────────────────────────────────────────────────── série de fluxo

  /**
   * Entradas e saídas por mês, para o gráfico de barras do dashboard e dos
   * relatórios. Agrega no banco em vez de trazer todos os lançamentos.
   */
  app.get<{ Querystring: { ate?: string; meses?: string } }>(
    '/api/cashflow',
    async (request) => {
      const ate = validar(competenciaSchema, request.query.ate ?? competenciaDe(new Date()));
      const quantos = Math.min(Math.max(Number(request.query.meses ?? 8), 1), 24);

      const [anoFim, mesFim] = ate.split('-').map(Number);
      const inicio = new Date(Date.UTC(anoFim!, mesFim! - quantos, 1));
      const fim = new Date(Date.UTC(anoFim!, mesFim!, 1));

      const transacoes = await prisma.transaction.findMany({
        where: { householdId: request.householdId, data: { gte: inicio, lt: fim } },
        select: { data: true, valor: true, tipo: true },
      });

      const buckets = new Map<string, { entradas: number; saidas: number }>();
      for (let i = 0; i < quantos; i++) {
        const d = new Date(Date.UTC(anoFim!, mesFim! - quantos + i, 1));
        buckets.set(competenciaDe(d), { entradas: 0, saidas: 0 });
      }
      for (const t of transacoes) {
        const bucket = buckets.get(competenciaDe(t.data));
        if (!bucket) continue;
        if (t.tipo === 'ENTRADA') bucket.entradas += Number(t.valor);
        else bucket.saidas += Number(t.valor);
      }

      return {
        ate,
        meses: [...buckets.entries()].map(([mes, v]) => ({ mes, ...v })),
      };
    },
  );
}
