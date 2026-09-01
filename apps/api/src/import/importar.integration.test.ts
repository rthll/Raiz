/**
 * Importação, regras automáticas e recorrências, contra o Postgres real.
 *
 * O que mais importa aqui é o **dedupe**: importar o mesmo extrato duas vezes é
 * o erro mais fácil de cometer e o mais chato de desfazer.
 */
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { analisarExtrato, gravarImportacao } from './importar.js';
import { parseCSV } from './parsers.js';
import { gerarRecorrentes, levantarAlertas, proximaOcorrencia } from '../jobs/recorrencias.js';

const prisma = new PrismaClient();

const bancoDisponivel = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false);

const suite = bancoDisponivel ? describe : describe.skip;
if (!bancoDisponivel) console.warn('\n[importar.integration] pulado: sem banco alcançável.\n');

let householdId = '';
let accountId = '';
let categoriaAlimentacao = '';
let categoriaOutros = '';

const EXTRATO = [
  'Data;Histórico;Valor',
  '10/08/2026;SUPERMERCADO SAO JOAO;-250,00',
  '11/08/2026;UBER TRIP 8829;-32,90',
  '12/08/2026;TRANSFERENCIA RECEBIDA;1500,00',
].join('\n');

beforeAll(async () => {
  if (!bancoDisponivel) return;

  const household = await prisma.household.create({ data: { nome: `Teste import ${Date.now()}` } });
  householdId = household.id;

  const conta = await prisma.account.create({
    data: { householdId, nome: 'Banco', tipo: 'CORRENTE', dono: 'Teste', saldo: 0 },
  });
  accountId = conta.id;

  const alimentacao = await prisma.category.create({
    data: { householdId, nome: 'Alimentação', tipo: 'SAIDA', cor: '#d67f48' },
  });
  categoriaAlimentacao = alimentacao.id;

  const outros = await prisma.category.create({
    data: { householdId, nome: 'Outros', tipo: 'SAIDA', cor: '#645c50' },
  });
  categoriaOutros = outros.id;

  await prisma.rule.create({
    data: { householdId, termo: 'SUPERMERC', categoriaId: alimentacao.id, acertos: 0, ordem: 0 },
  });
});

afterAll(async () => {
  if (bancoDisponivel && householdId) {
    await prisma.household.delete({ where: { id: householdId } });
  }
  await prisma.$disconnect();
});

const analisar = async () => {
  const { linhas, ignoradas, formato } = parseCSV(EXTRATO);
  return analisarExtrato(prisma, householdId, accountId, linhas, { ignoradas, formato });
};

const opcoes = {
  arquivo: 'extrato.csv',
  aplicarRegras: true,
  ignorarDuplicados: true,
  categoriaPadraoId: '',
  responsavel: 'CONJUNTA' as const,
};

suite('análise antes de gravar', () => {
  it('não grava nada — só relata o que entraria', async () => {
    const antes = await prisma.transaction.count({ where: { householdId } });
    const analise = await analisar();
    const depois = await prisma.transaction.count({ where: { householdId } });

    expect(analise.total).toBe(3);
    expect(depois).toBe(antes);
  });

  it('sugere categoria pela regra e diz qual termo casou', async () => {
    const analise = await analisar();
    const mercado = analise.linhas.find((l) => l.descricao.includes('SUPERMERCADO'))!;

    expect(mercado.categoriaId).toBe(categoriaAlimentacao);
    expect(mercado.categoriaNome).toBe('Alimentação');
    expect(mercado.regraTermo).toBe('SUPERMERC');
    expect(analise.classificadas).toBe(1);
  });

  it('deixa sem categoria o que nenhuma regra alcança', async () => {
    const analise = await analisar();
    const uber = analise.linhas.find((l) => l.descricao.includes('UBER'))!;
    expect(uber.categoriaId).toBeNull();
  });

  it('descobre o período coberto pelo arquivo', async () => {
    const analise = await analisar();
    expect(analise.periodo).toEqual({ inicio: '2026-08-10', fim: '2026-08-12' });
  });
});

suite('gravação e dedupe', () => {
  it('grava os lançamentos e o histórico de importação', async () => {
    const analise = await analisar();
    const resultado = await gravarImportacao(prisma, householdId, accountId, analise.linhas, {
      ...opcoes,
      categoriaPadraoId: categoriaOutros,
    });

    expect(resultado.criados).toBe(3);
    expect(resultado.classificados).toBe(1);

    const importacao = await prisma.import.findUnique({ where: { id: resultado.importId } });
    expect(importacao!.quantidade).toBe(3);
    expect(importacao!.arquivo).toBe('extrato.csv');
  });

  it('aplica a categoria da regra a quem casou, e a padrão ao resto', async () => {
    const mercado = await prisma.transaction.findFirst({
      where: { householdId, descricao: { contains: 'SUPERMERCADO' } },
    });
    const uber = await prisma.transaction.findFirst({
      where: { householdId, descricao: { contains: 'UBER' } },
    });
    expect(mercado!.categoriaId).toBe(categoriaAlimentacao);
    expect(uber!.categoriaId).toBe(categoriaOutros);
  });

  it('usa o sinal do valor para decidir entrada ou saída', async () => {
    const entrada = await prisma.transaction.findFirst({
      where: { householdId, descricao: { contains: 'TRANSFERENCIA' } },
    });
    expect(entrada!.tipo).toBe('ENTRADA');
    expect(Number(entrada!.valor)).toBe(1500);
  });

  it('incrementa o contador de acertos da regra', async () => {
    const regra = await prisma.rule.findFirst({ where: { householdId, termo: 'SUPERMERC' } });
    expect(regra!.acertos).toBe(1);
  });

  it('marca a conta como sincronizada', async () => {
    const conta = await prisma.account.findUnique({ where: { id: accountId } });
    expect(conta!.ultimaSync).not.toBeNull();
  });

  it('reconhece as três linhas como duplicadas na segunda análise', async () => {
    const analise = await analisar();
    expect(analise.duplicadas).toBe(3);
    expect(analise.linhas.every((l) => l.duplicada)).toBe(true);
  });

  it('importar o mesmo arquivo de novo não cria nada', async () => {
    const antes = await prisma.transaction.count({ where: { householdId } });
    const analise = await analisar();
    const resultado = await gravarImportacao(prisma, householdId, accountId, analise.linhas, {
      ...opcoes,
      categoriaPadraoId: categoriaOutros,
    });
    const depois = await prisma.transaction.count({ where: { householdId } });

    expect(resultado.criados).toBe(0);
    expect(depois).toBe(antes);
  });

  it('com ignorarDuplicados desligado, a constraint ainda barra a duplicata', async () => {
    const antes = await prisma.transaction.count({ where: { householdId } });
    const analise = await analisar();
    const resultado = await gravarImportacao(prisma, householdId, accountId, analise.linhas, {
      ...opcoes,
      ignorarDuplicados: false,
      categoriaPadraoId: categoriaOutros,
    });
    const depois = await prisma.transaction.count({ where: { householdId } });

    // Nenhuma criada, três puladas pela constraint de fingerprint.
    expect(resultado.criados).toBe(0);
    expect(resultado.puladas).toBe(3);
    expect(depois).toBe(antes);
  });

  it('detecta duplicata dentro do próprio arquivo', async () => {
    const repetido = [
      'Data;Histórico;Valor',
      '20/09/2026;COMPRA REPETIDA;-99,00',
      '20/09/2026;COMPRA REPETIDA;-99,00',
    ].join('\n');
    const { linhas, ignoradas, formato } = parseCSV(repetido);
    const analise = await analisarExtrato(prisma, householdId, accountId, linhas, {
      ignoradas,
      formato,
    });

    expect(analise.linhas[0]!.duplicada).toBe(false);
    expect(analise.linhas[1]!.duplicada).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────── recorrências

describe('proximaOcorrencia', () => {
  const em = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

  it('avança uma semana, um mês ou um ano', () => {
    expect(proximaOcorrencia(em('2026-08-05'), 'SEMANAL').toISOString().slice(0, 10)).toBe(
      '2026-08-12',
    );
    expect(proximaOcorrencia(em('2026-08-05'), 'MENSAL').toISOString().slice(0, 10)).toBe(
      '2026-09-05',
    );
    expect(proximaOcorrencia(em('2026-08-05'), 'ANUAL').toISOString().slice(0, 10)).toBe(
      '2027-08-05',
    );
  });

  it('encaixa o dia 31 no último dia dos meses curtos', () => {
    // Somar um mês a 31/01 no Date daria 03/03; aqui tem de dar 28/02.
    expect(proximaOcorrencia(em('2026-01-31'), 'MENSAL').toISOString().slice(0, 10)).toBe(
      '2026-02-28',
    );
    expect(proximaOcorrencia(em('2026-03-31'), 'MENSAL').toISOString().slice(0, 10)).toBe(
      '2026-04-30',
    );
  });

  it('vira o ano corretamente', () => {
    expect(proximaOcorrencia(em('2026-12-15'), 'MENSAL').toISOString().slice(0, 10)).toBe(
      '2027-01-15',
    );
  });
});

suite('geração de recorrentes', () => {
  it('põe em dia uma recorrência atrasada, criando um lançamento por mês', async () => {
    const recorrencia = await prisma.recurrence.create({
      data: {
        householdId,
        descricao: 'Aluguel',
        valor: 2200,
        periodo: 'MENSAL',
        // Três meses atrás: o job precisa gerar os três.
        proximaData: new Date('2026-05-05T00:00:00.000Z'),
        categoriaId: categoriaOutros,
        ativa: true,
      },
    });

    const resultado = await gerarRecorrentes(prisma, new Date('2026-07-10T12:00:00.000Z'));
    expect(resultado.criadas).toBe(3); // maio, junho e julho

    const criados = await prisma.transaction.findMany({
      where: { recurrenceId: recorrencia.id },
      orderBy: { data: 'asc' },
    });
    expect(criados.map((t) => t.data.toISOString().slice(0, 10))).toEqual([
      '2026-05-05',
      '2026-06-05',
      '2026-07-05',
    ]);

    // A próxima data avançou para depois de hoje.
    const atualizada = await prisma.recurrence.findUnique({ where: { id: recorrencia.id } });
    expect(atualizada!.proximaData.toISOString().slice(0, 10)).toBe('2026-08-05');
  });

  it('rodar duas vezes no mesmo dia não duplica — o job é idempotente', async () => {
    const antes = await prisma.transaction.count({ where: { householdId } });
    await gerarRecorrentes(prisma, new Date('2026-07-10T12:00:00.000Z'));
    const depois = await prisma.transaction.count({ where: { householdId } });
    expect(depois).toBe(antes);
  });

  it('ignora recorrência inativa', async () => {
    await prisma.recurrence.create({
      data: {
        householdId,
        descricao: 'Cancelada',
        valor: 100,
        periodo: 'MENSAL',
        proximaData: new Date('2026-06-01T00:00:00.000Z'),
        categoriaId: categoriaOutros,
        ativa: false,
      },
    });
    await gerarRecorrentes(prisma, new Date('2026-07-10T12:00:00.000Z'));
    const criados = await prisma.transaction.count({
      where: { householdId, descricao: 'Cancelada' },
    });
    expect(criados).toBe(0);
  });
});

suite('alertas', () => {
  it('avisa do teste grátis que vence nos próximos 3 dias', async () => {
    const cartao = await prisma.card.create({
      data: {
        householdId,
        nome: 'Cartão Teste',
        bandeira: 'VISA',
        final: '0001',
        limite: 1000,
        diaFechamento: 10,
        diaVencimento: 20,
      },
    });
    await prisma.subscription.create({
      data: {
        householdId,
        nome: 'App em teste',
        valor: 0,
        periodo: 'MENSAL',
        proximoDebito: new Date('2026-07-12T00:00:00.000Z'),
        cardId: cartao.id,
        categoriaId: categoriaOutros,
        status: 'TESTE',
        precoAnterior: 49.9,
      },
    });

    const alertas = await levantarAlertas(prisma, new Date('2026-07-10T00:00:00.000Z'));
    const teste = alertas.find(
      (a) => a.householdId === householdId && a.tipo === 'teste_gratis',
    );
    expect(teste).toBeDefined();
    expect(teste!.detalhe).toContain('49,90');
  });

  it('avisa da fatura que fecha em até 3 dias, e não da que fecha longe', async () => {
    // levantarAlertas varre todos os households de propósito — é um cron. Aqui
    // filtramos pela casa de teste, senão os cartões do seed entram na conta.
    const daCasa = (lista: Awaited<ReturnType<typeof levantarAlertas>>) =>
      lista.filter((a) => a.householdId === householdId && a.tipo === 'fatura_fechando');

    // Cartão fecha dia 10; em 08/07 faltam 2 dias.
    const perto = await levantarAlertas(prisma, new Date('2026-07-08T00:00:00.000Z'));
    expect(daCasa(perto)).toHaveLength(1);

    // Em 01/07 faltam 9 dias.
    const longe = await levantarAlertas(prisma, new Date('2026-07-01T00:00:00.000Z'));
    expect(daCasa(longe)).toHaveLength(0);
  });
});
