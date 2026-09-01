import type { PrismaClient } from '@prisma/client';
import { matchRule, transactionFingerprint } from '@raiz/core';
import type { LinhaExtrato } from './parsers.js';

/**
 * O que fazer com as linhas depois de lidas: detectar duplicata, sugerir
 * categoria pelas regras e, na confirmação, gravar.
 */

export interface LinhaAnalisada extends LinhaExtrato {
  fingerprint: string;
  /** Já existe um lançamento com este fingerprint neste household. */
  duplicada: boolean;
  /** Categoria sugerida pelas regras de classificação, se alguma casou. */
  categoriaId: string | null;
  categoriaNome: string | null;
  /** Termo da regra que casou — a UI mostra por que sugeriu aquilo. */
  regraTermo: string | null;
}

export interface Analise {
  linhas: LinhaAnalisada[];
  total: number;
  duplicadas: number;
  classificadas: number;
  ignoradas: Array<{ linha: number; conteudo: string; motivo: string }>;
  formato: 'CSV' | 'OFX';
  periodo: { inicio: string; fim: string };
}

/**
 * Analisa sem gravar nada.
 *
 * A separação entre analisar e gravar existe para que a pessoa **veja** o que
 * vai entrar antes de confirmar — o handoff pede a contagem no botão
 * ("Importar 42 lançamentos"), e importar às cegas um extrato de 200 linhas
 * classificadas por regra é receita de bagunça difícil de desfazer.
 */
export async function analisarExtrato(
  prisma: PrismaClient,
  householdId: string,
  accountId: string,
  linhas: LinhaExtrato[],
  extras: { ignoradas: Analise['ignoradas']; formato: 'CSV' | 'OFX' },
): Promise<Analise> {
  const regras = await prisma.rule.findMany({
    where: { householdId },
    orderBy: { ordem: 'asc' },
    include: { categoria: true },
  });

  const fingerprints = linhas.map((l) =>
    transactionFingerprint({
      data: l.data,
      valor: l.valor,
      descricao: l.descricao,
      accountId,
    }),
  );

  // Uma consulta só para todas as duplicatas, em vez de uma por linha.
  const existentes = await prisma.transaction.findMany({
    where: { householdId, fingerprint: { in: fingerprints } },
    select: { fingerprint: true },
  });
  const jaExiste = new Set(existentes.map((t) => t.fingerprint));

  // Duplicata dentro do próprio arquivo também conta — bancos repetem linha.
  const vistosNoArquivo = new Set<string>();

  const analisadas: LinhaAnalisada[] = linhas.map((linha, i) => {
    const fingerprint = fingerprints[i]!;
    const duplicada = jaExiste.has(fingerprint) || vistosNoArquivo.has(fingerprint);
    vistosNoArquivo.add(fingerprint);

    const regra = matchRule(linha.descricao, regras);

    return {
      ...linha,
      fingerprint,
      duplicada,
      categoriaId: regra?.categoriaId ?? null,
      categoriaNome: regra?.categoria.nome ?? null,
      regraTermo: regra?.termo ?? null,
    };
  });

  const datas = linhas.map((l) => l.data).sort();

  return {
    linhas: analisadas,
    total: analisadas.length,
    duplicadas: analisadas.filter((l) => l.duplicada).length,
    classificadas: analisadas.filter((l) => l.categoriaId).length,
    ignoradas: extras.ignoradas,
    formato: extras.formato,
    periodo: { inicio: datas[0] ?? '', fim: datas[datas.length - 1] ?? '' },
  };
}

export interface OpcoesGravacao {
  arquivo: string;
  aplicarRegras: boolean;
  ignorarDuplicados: boolean;
  /** Categoria para as linhas que nenhuma regra classificou. */
  categoriaPadraoId: string;
  responsavel: 'ANA' | 'BRUNO' | 'CONJUNTA';
}

export interface ResultadoImportacao {
  importId: string;
  criados: number;
  puladas: number;
  classificados: number;
}

/**
 * Grava as linhas escolhidas.
 *
 * Tudo em uma transação: ou o `Import` e seus lançamentos entram juntos, ou nada
 * entra. Um histórico de importação apontando para lançamentos que não existem
 * seria pior do que não ter histórico.
 */
export async function gravarImportacao(
  prisma: PrismaClient,
  householdId: string,
  accountId: string,
  linhas: LinhaAnalisada[],
  opcoes: OpcoesGravacao,
): Promise<ResultadoImportacao> {
  const aImportar = opcoes.ignorarDuplicados ? linhas.filter((l) => !l.duplicada) : linhas;
  const datas = aImportar.map((l) => l.data).sort();

  return prisma.$transaction(async (tx) => {
    const importacao = await tx.import.create({
      data: {
        householdId,
        accountId,
        arquivo: opcoes.arquivo,
        periodoInicio: new Date(`${datas[0] ?? new Date().toISOString().slice(0, 10)}T00:00:00Z`),
        periodoFim: new Date(
          `${datas[datas.length - 1] ?? new Date().toISOString().slice(0, 10)}T00:00:00Z`,
        ),
        quantidade: aImportar.length,
        classificados: aImportar.filter((l) => l.categoriaId).length,
      },
    });

    /*
     * Filtra as duplicatas ANTES de inserir, e insere tudo de uma vez.
     *
     * Um `try/catch` por linha não funciona aqui: no Postgres, uma statement que
     * viola constraint aborta a transação inteira (SQLSTATE 25P02), e o `catch`
     * do JavaScript não desfaz isso — a próxima query falharia com "transação
     * atual foi interrompida". `createMany` com `skipDuplicates` vira
     * `ON CONFLICT DO NOTHING`, que não aborta nada.
     */
    const jaNoBanco = await tx.transaction.findMany({
      where: { householdId, fingerprint: { in: aImportar.map((l) => l.fingerprint) } },
      select: { fingerprint: true },
    });
    const existentes = new Set(jaNoBanco.map((t) => t.fingerprint));

    const vistos = new Set<string>();
    const novas = aImportar.filter((l) => {
      if (existentes.has(l.fingerprint) || vistos.has(l.fingerprint)) return false;
      vistos.add(l.fingerprint);
      return true;
    });

    const { count: criados } = await tx.transaction.createMany({
      data: novas.map((linha) => ({
        householdId,
        data: new Date(`${linha.data}T00:00:00.000Z`),
        descricao: linha.descricao,
        valor: linha.valor,
        tipo: linha.tipo,
        categoriaId:
          opcoes.aplicarRegras && linha.categoriaId ? linha.categoriaId : opcoes.categoriaPadraoId,
        accountId,
        responsavel: opcoes.responsavel,
        importId: importacao.id,
        fingerprint: linha.fingerprint,
      })),
      // Rede de segurança para uma corrida entre dois uploads simultâneos.
      skipDuplicates: true,
    });

    const puladas = aImportar.length - criados;
    const classificadas = novas.filter((l) => opcoes.aplicarRegras && l.categoriaId);
    const classificados = classificadas.length;

    const acertosPorRegra = new Map<string, number>();
    for (const linha of classificadas) {
      if (linha.regraTermo) {
        acertosPorRegra.set(linha.regraTermo, (acertosPorRegra.get(linha.regraTermo) ?? 0) + 1);
      }
    }

    // O contador de acertos da regra é o que mostra, na tela de categorias,
    // quais regras estão realmente puxando o próprio peso.
    for (const [termo, quantidade] of acertosPorRegra) {
      await tx.rule.updateMany({
        where: { householdId, termo },
        data: { acertos: { increment: quantidade } },
      });
    }

    await tx.import.update({
      where: { id: importacao.id },
      data: { quantidade: criados, classificados },
    });

    await tx.account.update({
      where: { id: accountId },
      data: { ultimaSync: new Date() },
    });

    return { importId: importacao.id, criados, puladas, classificados };
  });
}
