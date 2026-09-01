import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import type { PrismaClient } from '@prisma/client';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import { prisma as prismaPadrao } from './db.js';
import { loadEnv, type Env } from './env.js';
import { HttpError, responderErro } from './http/errors.js';
import { authPlugin } from './plugins/auth.js';
import { analyticsRoutes } from './routes/analytics.js';
import { authRoutes } from './routes/auth.js';
import { cronRoutes } from './routes/cron.js';
import { importRoutes } from './routes/imports.js';
import { entityRoutes } from './routes/entities.js';
import { invoiceRoutes } from './routes/invoices.js';
import { subscriptionRoutes } from './routes/subscriptions.js';
import { transactionRoutes } from './routes/transactions.js';

export interface BuildOptions {
  env?: Env;
  logger?: boolean;
  /** Injetável para os testes usarem um banco próprio. */
  prisma?: PrismaClient;
}

/**
 * Monta a instância do Fastify.
 *
 * Fica separada de `server.ts` porque a mesma instância é reaproveitada por
 * `api/index.ts` (a Vercel Function) e pelos testes — só o `listen` muda.
 */
export function buildApp({
  env = loadEnv(),
  logger,
  prisma = prismaPadrao,
}: BuildOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: logger ?? env.NODE_ENV === 'development',
    // A Vercel já injeta um request id; reaproveitar mantém o rastro entre logs.
    requestIdHeader: 'x-vercel-id',
    trustProxy: true,
  });

  app.register(cors, {
    origin: env.corsOrigins,
    credentials: true,
  });
  app.register(cookie);
  app.register(authPlugin, { env });

  app.get('/api/health', async () => ({
    status: 'ok',
    service: 'raiz-api',
    env: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  }));

  app.register(authRoutes, { prisma, env });
  app.register(entityRoutes, { prisma });
  app.register(transactionRoutes, { prisma });
  app.register(subscriptionRoutes, { prisma });
  app.register(invoiceRoutes, { prisma });
  app.register(analyticsRoutes, { prisma });
  app.register(importRoutes, { prisma });
  app.register(cronRoutes, { prisma, env });

  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      error: 'not_found',
      message: `Rota ${request.method} ${request.url} não existe.`,
    });
  });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    // Erros de domínio já vêm com status, código e mensagem em pt-BR.
    if (error instanceof HttpError) return responderErro(reply, error);

    request.log.error(error);
    const status = error.statusCode ?? 500;
    return reply.code(status).send({
      error: status >= 500 ? 'internal_error' : 'request_error',
      // Erro 5xx nunca vaza detalhe interno para o cliente.
      message: status >= 500 ? 'Erro interno.' : error.message,
    });
  });

  return app;
}
