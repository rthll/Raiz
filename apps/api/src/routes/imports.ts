import multipart from '@fastify/multipart';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { importacaoDTO } from '../http/dto.js';
import { HttpError, invalido, validar } from '../http/errors.js';
import { exigirEncontrado } from '../http/scope.js';
import { analisarExtrato, gravarImportacao, type LinhaAnalisada } from '../import/importar.js';
import { ExtratoInvalidoError, parseExtrato } from '../import/parsers.js';

interface Deps {
  prisma: PrismaClient;
}

/** O handoff limita a 5 MB — um extrato de um ano não passa de algumas centenas de KB. */
const TAMANHO_MAXIMO = 5 * 1024 * 1024;

const linhaAnalisada = z.object({
  data: z.string(),
  descricao: z.string(),
  valor: z.number(),
  tipo: z.enum(['ENTRADA', 'SAIDA']),
  fingerprint: z.string(),
  duplicada: z.boolean(),
  categoriaId: z.string().nullable(),
  categoriaNome: z.string().nullable(),
  regraTermo: z.string().nullable(),
});

const confirmarSchema = z.object({
  accountId: z.string().min(1, 'Escolha a conta de destino.'),
  arquivo: z.string().min(1),
  linhas: z.array(linhaAnalisada).min(1, 'Nada para importar.'),
  aplicarRegras: z.boolean().default(true),
  ignorarDuplicados: z.boolean().default(true),
  categoriaPadraoId: z.string().min(1, 'Escolha a categoria padrão.'),
  responsavel: z.enum(['ANA', 'BRUNO', 'CONJUNTA']).default('CONJUNTA'),
});

export async function importRoutes(app: FastifyInstance, { prisma }: Deps) {
  await app.register(multipart, {
    limits: { fileSize: TAMANHO_MAXIMO, files: 1 },
  });

  app.addHook('preHandler', app.autenticar);

  /** Histórico de importações — a tabela no rodapé da tela de contas. */
  app.get('/api/imports', async (request) => {
    const imports = await prisma.import.findMany({
      where: { householdId: request.householdId },
      orderBy: { criadoEm: 'desc' },
      take: 20,
    });
    return imports.map(importacaoDTO);
  });

  /**
   * Lê o arquivo e devolve o que *seria* importado, sem gravar nada.
   *
   * O cliente guarda essa resposta e manda de volta na confirmação. Assim não há
   * estado de sessão no servidor, e a pessoa vê exatamente o que vai entrar.
   */
  app.post('/api/imports/preview', async (request) => {
    const arquivo = await request.file().catch(() => null);
    if (!arquivo) throw invalido('Envie um arquivo CSV ou OFX.');

    const accountId = String(
      (arquivo.fields.accountId as { value?: string } | undefined)?.value ?? '',
    );
    if (!accountId) throw invalido('Escolha a conta de destino.', { accountId: 'Obrigatório.' });

    const conta = await prisma.account.findFirst({
      where: { id: accountId, householdId: request.householdId },
    });
    exigirEncontrado(conta, 'Conta');

    const buffer = await arquivo.toBuffer().catch(() => {
      // O @fastify/multipart corta no limite e sinaliza por aqui.
      throw new HttpError(413, 'arquivo_grande', 'O arquivo passa de 5 MB.');
    });
    if (arquivo.file.truncated) {
      throw new HttpError(413, 'arquivo_grande', 'O arquivo passa de 5 MB.');
    }

    let conteudo = buffer.toString('utf8');
    // Extratos de banco brasileiro costumam vir em latin1; o sinal é o caractere
    // de substituição aparecendo onde deveria haver acento.
    if (conteudo.includes('�')) conteudo = buffer.toString('latin1');

    try {
      const { linhas, ignoradas, formato } = parseExtrato(conteudo, arquivo.filename);
      const analise = await analisarExtrato(prisma, request.householdId, accountId, linhas, {
        ignoradas,
        formato,
      });
      return { arquivo: arquivo.filename, accountId, ...analise };
    } catch (erro) {
      if (erro instanceof ExtratoInvalidoError) {
        // Mensagem do parser: já explica qual coluna faltou ou o que não bateu.
        throw new HttpError(422, 'extrato_invalido', erro.message);
      }
      throw erro;
    }
  });

  /** Grava o que a pessoa confirmou na prévia. */
  app.post('/api/imports/confirm', async (request, reply) => {
    const dados = validar(confirmarSchema, request.body);

    const conta = await prisma.account.findFirst({
      where: { id: dados.accountId, householdId: request.householdId },
    });
    exigirEncontrado(conta, 'Conta');

    const categoriaPadrao = await prisma.category.findFirst({
      where: { id: dados.categoriaPadraoId, householdId: request.householdId },
    });
    exigirEncontrado(categoriaPadrao, 'Categoria');

    // As categorias sugeridas vieram do cliente; conferir que são do household
    // impede que um id de outra casa entre por aqui.
    const sugeridas = [...new Set(dados.linhas.map((l) => l.categoriaId).filter(Boolean))];
    if (sugeridas.length > 0) {
      const validas = await prisma.category.findMany({
        where: { id: { in: sugeridas as string[] }, householdId: request.householdId },
        select: { id: true },
      });
      const permitidas = new Set(validas.map((c) => c.id));
      for (const linha of dados.linhas) {
        if (linha.categoriaId && !permitidas.has(linha.categoriaId)) linha.categoriaId = null;
      }
    }

    const resultado = await gravarImportacao(
      prisma,
      request.householdId,
      dados.accountId,
      dados.linhas as LinhaAnalisada[],
      {
        arquivo: dados.arquivo,
        aplicarRegras: dados.aplicarRegras,
        ignorarDuplicados: dados.ignorarDuplicados,
        categoriaPadraoId: dados.categoriaPadraoId,
        responsavel: dados.responsavel,
      },
    );

    return reply.code(201).send(resultado);
  });
}
