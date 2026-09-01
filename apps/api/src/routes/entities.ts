import type { PrismaClient } from '@prisma/client';
import {
  ativoSchema,
  cartaoSchema,
  categoriaSchema,
  contaSchema,
  metaSchema,
  regraSchema,
} from '@raiz/schemas';
import type { FastifyInstance } from 'fastify';
import { ativoDTO, cartaoDTO, categoriaDTO, contaDTO, metaDTO, regraDTO } from '../http/dto.js';
import { conflito, validar } from '../http/errors.js';
import { exigirAfetado, exigirEncontrado } from '../http/scope.js';

interface Deps {
  prisma: PrismaClient;
}

interface Params {
  id: string;
}

/**
 * CRUD das entidades simples: contas, cartões, categorias, ativos, metas e regras.
 *
 * Toda query carrega `householdId: request.householdId`, que vem do access token
 * — nunca do corpo nem da query string. Escritas usam `updateMany`/`deleteMany`
 * com o household no `where`, então o escopo é aplicado na própria operação, sem
 * a janela entre "buscar e conferir" e "escrever".
 */
export async function entityRoutes(app: FastifyInstance, { prisma }: Deps) {
  app.addHook('preHandler', app.autenticar);

  // ───────────────────────────────────────────────────────────── contas

  app.get('/api/accounts', async (request) => {
    const contas = await prisma.account.findMany({
      where: { householdId: request.householdId },
      orderBy: { nome: 'asc' },
    });
    return contas.map(contaDTO);
  });

  app.post('/api/accounts', async (request, reply) => {
    const dados = validar(contaSchema, request.body);
    const criada = await prisma.account
      .create({ data: { ...dados, householdId: request.householdId } })
      .catch(() => {
        throw conflito('Já existe uma conta com esse nome.');
      });
    return reply.code(201).send(contaDTO(criada));
  });

  app.put<{ Params: Params }>('/api/accounts/:id', async (request) => {
    const dados = validar(contaSchema, request.body);
    const { count } = await prisma.account.updateMany({
      where: { id: request.params.id, householdId: request.householdId },
      data: dados,
    });
    exigirAfetado(count, 'Conta');
    const atualizada = await prisma.account.findUnique({ where: { id: request.params.id } });
    return contaDTO(exigirEncontrado(atualizada, 'Conta'));
  });

  app.delete<{ Params: Params }>('/api/accounts/:id', async (request, reply) => {
    const emUso = await prisma.transaction.count({
      where: { accountId: request.params.id, householdId: request.householdId },
    });
    if (emUso > 0) {
      throw conflito(
        `Esta conta tem ${emUso} lançamento(s). Mova ou exclua os lançamentos antes.`,
      );
    }
    const { count } = await prisma.account.deleteMany({
      where: { id: request.params.id, householdId: request.householdId },
    });
    exigirAfetado(count, 'Conta');
    return reply.code(204).send();
  });

  // ──────────────────────────────────────────────────────────── cartões

  app.get('/api/cards', async (request) => {
    const cartoes = await prisma.card.findMany({
      where: { householdId: request.householdId },
      orderBy: { ordem: 'asc' },
    });
    return cartoes.map(cartaoDTO);
  });

  app.post('/api/cards', async (request, reply) => {
    const dados = validar(cartaoSchema, request.body);
    const quantos = await prisma.card.count({ where: { householdId: request.householdId } });
    const criado = await prisma.card
      .create({
        // O primeiro cartão do household é o escuro, como no design.
        data: {
          ...dados,
          temaEscuro: dados.temaEscuro || quantos === 0,
          ordem: quantos,
          householdId: request.householdId,
        },
      })
      .catch(() => {
        throw conflito('Já existe um cartão com esse apelido.');
      });
    return reply.code(201).send(cartaoDTO(criado));
  });

  app.put<{ Params: Params }>('/api/cards/:id', async (request) => {
    const dados = validar(cartaoSchema, request.body);
    const { count } = await prisma.card.updateMany({
      where: { id: request.params.id, householdId: request.householdId },
      data: dados,
    });
    exigirAfetado(count, 'Cartão');
    const atualizado = await prisma.card.findUnique({ where: { id: request.params.id } });
    return cartaoDTO(exigirEncontrado(atualizado, 'Cartão'));
  });

  app.delete<{ Params: Params }>('/api/cards/:id', async (request, reply) => {
    const emUso = await prisma.transaction.count({
      where: { cardId: request.params.id, householdId: request.householdId },
    });
    if (emUso > 0) {
      throw conflito(`Este cartão tem ${emUso} lançamento(s) na fatura. Exclua-os antes.`);
    }
    const { count } = await prisma.card.deleteMany({
      where: { id: request.params.id, householdId: request.householdId },
    });
    exigirAfetado(count, 'Cartão');
    return reply.code(204).send();
  });

  // ────────────────────────────────────────────────────────── categorias

  app.get('/api/categories', async (request) => {
    const categorias = await prisma.category.findMany({
      where: { householdId: request.householdId },
      orderBy: { ordem: 'asc' },
    });
    return categorias.map(categoriaDTO);
  });

  app.post('/api/categories', async (request, reply) => {
    const dados = validar(categoriaSchema, request.body);
    const quantas = await prisma.category.count({ where: { householdId: request.householdId } });
    const criada = await prisma.category
      .create({ data: { ...dados, ordem: quantas, householdId: request.householdId } })
      .catch(() => {
        throw conflito('Já existe uma categoria com esse nome.');
      });
    return reply.code(201).send(categoriaDTO(criada));
  });

  app.put<{ Params: Params }>('/api/categories/:id', async (request) => {
    const dados = validar(categoriaSchema, request.body);
    const { count } = await prisma.category.updateMany({
      where: { id: request.params.id, householdId: request.householdId },
      data: dados,
    });
    exigirAfetado(count, 'Categoria');
    const atualizada = await prisma.category.findUnique({ where: { id: request.params.id } });
    return categoriaDTO(exigirEncontrado(atualizada, 'Categoria'));
  });

  app.delete<{ Params: Params }>('/api/categories/:id', async (request, reply) => {
    // O schema usa onDelete: Restrict aqui — uma categoria com lançamentos não
    // pode sumir e levar o histórico junto.
    const emUso = await prisma.transaction.count({
      where: { categoriaId: request.params.id, householdId: request.householdId },
    });
    if (emUso > 0) {
      throw conflito(
        `Esta categoria classifica ${emUso} lançamento(s). Reclassifique-os antes de excluir.`,
      );
    }
    const { count } = await prisma.category.deleteMany({
      where: { id: request.params.id, householdId: request.householdId },
    });
    exigirAfetado(count, 'Categoria');
    return reply.code(204).send();
  });

  // ───────────────────────────────────────────────────────────── ativos

  app.get('/api/assets', async (request) => {
    const ativos = await prisma.asset.findMany({
      where: { householdId: request.householdId },
      orderBy: { ordem: 'asc' },
    });
    return ativos.map(ativoDTO);
  });

  app.post('/api/assets', async (request, reply) => {
    const dados = validar(ativoSchema, request.body);
    const quantos = await prisma.asset.count({ where: { householdId: request.householdId } });
    const criado = await prisma.asset.create({
      data: { ...dados, ordem: quantos, householdId: request.householdId },
    });
    return reply.code(201).send(ativoDTO(criado));
  });

  app.put<{ Params: Params }>('/api/assets/:id', async (request) => {
    const dados = validar(ativoSchema, request.body);
    const { count } = await prisma.asset.updateMany({
      where: { id: request.params.id, householdId: request.householdId },
      data: dados,
    });
    exigirAfetado(count, 'Ativo');
    const atualizado = await prisma.asset.findUnique({ where: { id: request.params.id } });
    return ativoDTO(exigirEncontrado(atualizado, 'Ativo'));
  });

  app.delete<{ Params: Params }>('/api/assets/:id', async (request, reply) => {
    const { count } = await prisma.asset.deleteMany({
      where: { id: request.params.id, householdId: request.householdId },
    });
    exigirAfetado(count, 'Ativo');
    return reply.code(204).send();
  });

  // ────────────────────────────────────────────────────────────── metas

  app.get('/api/goals', async (request) => {
    const metas = await prisma.goal.findMany({
      where: { householdId: request.householdId },
      orderBy: { ordem: 'asc' },
    });
    return metas.map(metaDTO);
  });

  app.post('/api/goals', async (request, reply) => {
    const dados = validar(metaSchema, request.body);
    const quantas = await prisma.goal.count({ where: { householdId: request.householdId } });
    const criada = await prisma.goal.create({
      data: { ...dados, ordem: quantas, householdId: request.householdId },
    });
    return reply.code(201).send(metaDTO(criada));
  });

  app.put<{ Params: Params }>('/api/goals/:id', async (request) => {
    const dados = validar(metaSchema, request.body);
    const { count } = await prisma.goal.updateMany({
      where: { id: request.params.id, householdId: request.householdId },
      data: dados,
    });
    exigirAfetado(count, 'Meta');
    const atualizada = await prisma.goal.findUnique({ where: { id: request.params.id } });
    return metaDTO(exigirEncontrado(atualizada, 'Meta'));
  });

  app.delete<{ Params: Params }>('/api/goals/:id', async (request, reply) => {
    const { count } = await prisma.goal.deleteMany({
      where: { id: request.params.id, householdId: request.householdId },
    });
    exigirAfetado(count, 'Meta');
    return reply.code(204).send();
  });

  // ────────────────────────────────────────── regras de classificação

  app.get('/api/rules', async (request) => {
    const regras = await prisma.rule.findMany({
      where: { householdId: request.householdId },
      orderBy: { ordem: 'asc' },
    });
    return regras.map(regraDTO);
  });

  app.post('/api/rules', async (request, reply) => {
    const dados = validar(regraSchema, request.body);
    // A categoria tem de ser do mesmo household — senão a regra viraria um
    // ponteiro para fora do escopo.
    const categoria = await prisma.category.findFirst({
      where: { id: dados.categoriaId, householdId: request.householdId },
    });
    exigirEncontrado(categoria, 'Categoria');

    const quantas = await prisma.rule.count({ where: { householdId: request.householdId } });
    const criada = await prisma.rule.create({
      data: { ...dados, ordem: quantas, householdId: request.householdId },
    });
    return reply.code(201).send(regraDTO(criada));
  });

  app.put<{ Params: Params }>('/api/rules/:id', async (request) => {
    const dados = validar(regraSchema, request.body);
    const categoria = await prisma.category.findFirst({
      where: { id: dados.categoriaId, householdId: request.householdId },
    });
    exigirEncontrado(categoria, 'Categoria');

    const { count } = await prisma.rule.updateMany({
      where: { id: request.params.id, householdId: request.householdId },
      data: dados,
    });
    exigirAfetado(count, 'Regra');
    const atualizada = await prisma.rule.findUnique({ where: { id: request.params.id } });
    return regraDTO(exigirEncontrado(atualizada, 'Regra'));
  });

  app.delete<{ Params: Params }>('/api/rules/:id', async (request, reply) => {
    const { count } = await prisma.rule.deleteMany({
      where: { id: request.params.id, householdId: request.householdId },
    });
    exigirAfetado(count, 'Regra');
    return reply.code(204).send();
  });
}
