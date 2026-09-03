/**
 * Endurecimento de produção.
 *
 * Não precisa de banco: usa um Prisma falso, porque o que se verifica aqui é o
 * comportamento HTTP — quantas tentativas passam, quais cabeçalhos saem, e o que
 * a API responde quando o Postgres some.
 */
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../app.js';
import { loadEnv } from '../env.js';

const env = loadEnv({
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://x:y@localhost:5432/z',
  JWT_SECRET: 'a'.repeat(48),
  JWT_REFRESH_SECRET: 'b'.repeat(48),
  CRON_SECRET: 'c'.repeat(24),
  CORS_ORIGINS: 'https://raiz.app',
} as never);

/** Prisma mínimo: só o que as rotas exercitadas aqui tocam. */
function prismaFalso(opcoes: { bancoNoAr?: boolean } = {}): PrismaClient {
  const { bancoNoAr = true } = opcoes;
  return {
    $queryRaw: vi.fn(async () => {
      if (!bancoNoAr) throw new Error('sem conexão');
      return [{ '?column?': 1 }];
    }),
    user: { findUnique: vi.fn(async () => null) },
  } as unknown as PrismaClient;
}

let app: FastifyInstance | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('limite de tentativas', () => {
  it('bloqueia a sexta tentativa de login no mesmo minuto', async () => {
    app = buildApp({ env, logger: false, prisma: prismaFalso() });
    await app.ready();

    const tentar = () =>
      app!.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'alguem@raiz.app', senha: 'chute' },
        remoteAddress: '203.0.113.10',
      });

    const codigos: number[] = [];
    for (let i = 0; i < 6; i++) codigos.push((await tentar()).statusCode);

    // As cinco primeiras chegam ao handler e falham por credencial.
    expect(codigos.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    // A sexta nem chega lá.
    expect(codigos[5]).toBe(429);
  });

  it('a resposta de bloqueio diz em quantos segundos tentar de novo', async () => {
    app = buildApp({ env, logger: false, prisma: prismaFalso() });
    await app.ready();

    let resposta;
    for (let i = 0; i < 6; i++) {
      resposta = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'x@raiz.app', senha: 'y' },
        remoteAddress: '203.0.113.20',
      });
    }

    expect(resposta!.statusCode).toBe(429);
    expect(resposta!.json().error).toBe('muitas_tentativas');
    expect(resposta!.json().message).toMatch(/Tente de novo em \d+ segundos/);
  });

  it('o limite é por IP: um atacante não tranca os outros', async () => {
    app = buildApp({ env, logger: false, prisma: prismaFalso() });
    await app.ready();

    const doIp = (ip: string) =>
      app!.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'x@raiz.app', senha: 'y' },
        remoteAddress: ip,
      });

    for (let i = 0; i < 6; i++) await doIp('203.0.113.30');
    expect((await doIp('203.0.113.30')).statusCode).toBe(429);
    // Outro IP continua livre.
    expect((await doIp('203.0.113.31')).statusCode).toBe(401);
  });

  it('rotas que já exigem token não são limitadas', async () => {
    app = buildApp({ env, logger: false, prisma: prismaFalso() });
    await app.ready();

    const codigos: number[] = [];
    for (let i = 0; i < 10; i++) {
      const r = await app.inject({
        method: 'GET',
        url: '/api/accounts',
        remoteAddress: '203.0.113.40',
      });
      codigos.push(r.statusCode);
    }
    // Sempre 401 por falta de token, nunca 429.
    expect(new Set(codigos)).toEqual(new Set([401]));
  });
});

describe('cabeçalhos de segurança', () => {
  it('a API se declara não renderizável e não embutível', async () => {
    app = buildApp({ env, logger: false, prisma: prismaFalso() });
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/api/health' });
    const csp = res.headers['content-security-policy'] as string;

    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('HSTS só em produção — em dev quebraria o localhost em http', async () => {
    app = buildApp({ env, logger: false, prisma: prismaFalso() });
    await app.ready();
    const emTeste = await app.inject({ method: 'GET', url: '/api/health' });
    expect(emTeste.headers['strict-transport-security']).toBeUndefined();
    await app.close();

    const envProd = loadEnv({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://x:y@localhost:5432/z',
      JWT_SECRET: 'a'.repeat(48),
      JWT_REFRESH_SECRET: 'b'.repeat(48),
      CORS_ORIGINS: 'https://raiz.app',
    } as never);
    app = buildApp({ env: envProd, logger: false, prisma: prismaFalso() });
    await app.ready();
    const emProd = await app.inject({ method: 'GET', url: '/api/health' });
    expect(emProd.headers['strict-transport-security']).toContain('max-age=31536000');
  });
});

describe('health check', () => {
  it('responde 200 com o banco no ar', async () => {
    app = buildApp({ env, logger: false, prisma: prismaFalso({ bancoNoAr: true }) });
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok', banco: 'ok' });
    expect(typeof res.json().latenciaBancoMs).toBe('number');
  });

  it('responde 503 quando o banco some, em vez de fingir que está tudo bem', async () => {
    app = buildApp({ env, logger: false, prisma: prismaFalso({ bancoNoAr: false }) });
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/api/health' });
    // Um 200 aqui deixaria o monitoramento verde com todas as telas quebradas.
    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ status: 'degradado', banco: 'indisponivel' });
  });
});
