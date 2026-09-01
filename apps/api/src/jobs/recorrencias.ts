import type { PeriodoRecorrencia, PrismaClient } from '@prisma/client';
import { transactionFingerprint } from '@raiz/core';

/**
 * Geração dos lançamentos recorrentes.
 *
 * O job roda uma vez por dia e "põe em dia" cada recorrência: enquanto a
 * `proximaData` estiver no passado ou for hoje, cria o lançamento e avança.
 * O laço existe porque o job pode não ter rodado por dias — um deploy demorado,
 * um fim de semana com o cron parado — e a recorrência não pode perder meses.
 */

/** Avança uma data pelo período, preservando o dia do mês quando possível. */
export function proximaOcorrencia(data: Date, periodo: PeriodoRecorrencia): Date {
  const ano = data.getUTCFullYear();
  const mes = data.getUTCMonth();
  const dia = data.getUTCDate();

  if (periodo === 'SEMANAL') {
    return new Date(Date.UTC(ano, mes, dia + 7));
  }

  const meses = periodo === 'ANUAL' ? 12 : 1;
  /*
   * Um lançamento marcado para dia 31 precisa cair em 28/02 em fevereiro, e
   * voltar para 31 em março. Guardar o dia original e limitá-lo ao tamanho do
   * mês faz isso; somar meses direto no Date empurraria fevereiro para março.
   */
  const alvo = new Date(Date.UTC(ano, mes + meses, 1));
  const ultimoDia = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth(), Math.min(dia, ultimoDia)));
}

export interface ResultadoRecorrencias {
  processadas: number;
  criadas: number;
  puladas: number;
}

const LIMITE_POR_RECORRENCIA = 24;

export async function gerarRecorrentes(
  prisma: PrismaClient,
  hoje = new Date(),
): Promise<ResultadoRecorrencias> {
  const fimDoDia = new Date(
    Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate(), 23, 59, 59),
  );

  const pendentes = await prisma.recurrence.findMany({
    where: { ativa: true, proximaData: { lte: fimDoDia } },
  });

  let criadas = 0;
  let puladas = 0;

  for (const recorrencia of pendentes) {
    let data = recorrencia.proximaData;
    let voltas = 0;

    while (data <= fimDoDia && voltas < LIMITE_POR_RECORRENCIA) {
      const iso = data.toISOString().slice(0, 10);
      try {
        await prisma.transaction.create({
          data: {
            householdId: recorrencia.householdId,
            data,
            descricao: recorrencia.descricao,
            valor: recorrencia.valor,
            // Recorrência de valor positivo é entrada; o modelo guarda o valor
            // absoluto e o tipo vem do sinal, como na importação.
            tipo: Number(recorrencia.valor) >= 0 ? 'SAIDA' : 'ENTRADA',
            categoriaId: recorrencia.categoriaId,
            responsavel: 'CONJUNTA',
            recurrenceId: recorrencia.id,
            fingerprint: transactionFingerprint({
              data: iso,
              valor: Number(recorrencia.valor),
              descricao: recorrencia.descricao,
              accountId: `rec:${recorrencia.id}`,
            }),
          },
        });
        criadas++;
      } catch {
        // Já existe: o job rodou duas vezes no mesmo dia. É o comportamento
        // desejado — a constraint de fingerprint torna o job idempotente.
        puladas++;
      }

      data = proximaOcorrencia(data, recorrencia.periodo);
      voltas++;
    }

    await prisma.recurrence.update({
      where: { id: recorrencia.id },
      data: { proximaData: data },
    });
  }

  return { processadas: pendentes.length, criadas, puladas };
}

// ─────────────────────────────────────────────────────────────── alertas

export interface Alerta {
  householdId: string;
  tipo: 'teste_gratis' | 'fatura_fechando';
  titulo: string;
  detalhe: string;
  data: string;
}

/**
 * Levanta o que merece aviso hoje: teste grátis virando cobrança e fatura
 * fechando em até 3 dias (D-3, como o handoff pede).
 *
 * Só **levanta** — não envia. Não há canal de notificação configurado ainda;
 * quando houver, ele consome esta lista. Enquanto isso, o dashboard mostra os
 * mesmos alertas na tela.
 */
export async function levantarAlertas(
  prisma: PrismaClient,
  hoje = new Date(),
): Promise<Alerta[]> {
  const alertas: Alerta[] = [];
  const em3Dias = new Date(hoje.getTime() + 3 * 24 * 60 * 60 * 1000);

  const testes = await prisma.subscription.findMany({
    where: { status: 'TESTE', proximoDebito: { gte: hoje, lte: em3Dias } },
  });
  for (const teste of testes) {
    alertas.push({
      householdId: teste.householdId,
      tipo: 'teste_gratis',
      titulo: `${teste.nome} sai do teste grátis`,
      detalhe: teste.precoAnterior
        ? `Passa a custar R$ ${Number(teste.precoAnterior).toFixed(2).replace('.', ',')}.`
        : 'A cobrança começa nesta data.',
      data: teste.proximoDebito.toISOString().slice(0, 10),
    });
  }

  const cartoes = await prisma.card.findMany();
  for (const cartao of cartoes) {
    // Dias até o próximo fechamento, virando o mês quando já passou.
    const diaHoje = hoje.getUTCDate();
    const faltam =
      cartao.diaFechamento >= diaHoje
        ? cartao.diaFechamento - diaHoje
        : cartao.diaFechamento +
          new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + 1, 0)).getUTCDate() -
          diaHoje;

    if (faltam <= 3) {
      alertas.push({
        householdId: cartao.householdId,
        tipo: 'fatura_fechando',
        titulo: `A fatura do ${cartao.nome} fecha em ${faltam} dia${faltam === 1 ? '' : 's'}`,
        detalhe: `Fechamento no dia ${cartao.diaFechamento}, vencimento no dia ${cartao.diaVencimento}.`,
        data: hoje.toISOString().slice(0, 10),
      });
    }
  }

  return alertas;
}
