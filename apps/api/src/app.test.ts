import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { loadEnv } from './env.js';

const base = {
  NODE_ENV: 'test',
  PORT: '3333',
  CORS_ORIGINS: 'http://localhost:5173',
  DATABASE_URL: 'postgresql://raiz:raiz@localhost:5432/raiz',
  JWT_SECRET: 'a'.repeat(48),
  JWT_REFRESH_SECRET: 'b'.repeat(48),
};

const env = loadEnv(base as never);

describe('API', () => {
  it('responde no health check sem exigir autenticação', async () => {
    const app = buildApp({ env, logger: false });
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok', service: 'raiz-api', env: 'test' });
    await app.close();
  });

  it('devolve 404 em pt-BR para rota inexistente', async () => {
    const app = buildApp({ env, logger: false });
    const res = await app.inject({ method: 'GET', url: '/api/nao-existe' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('not_found');
    await app.close();
  });
});

describe('env', () => {
  it('exige as variáveis sem as quais a API não funciona', () => {
    expect(() => loadEnv({} as never)).toThrow(/DATABASE_URL/);
    expect(() => loadEnv({ DATABASE_URL: base.DATABASE_URL } as never)).toThrow(/JWT_SECRET/);
  });

  it('recusa segredo curto demais', () => {
    expect(() => loadEnv({ ...base, JWT_SECRET: 'curto' } as never)).toThrow(
      /pelo menos 32 caracteres/,
    );
  });

  it('recusa os dois segredos iguais', () => {
    // Se forem iguais, um access token vazado vale como refresh token.
    expect(() =>
      loadEnv({ ...base, JWT_REFRESH_SECRET: base.JWT_SECRET } as never),
    ).toThrow(/precisam ser diferentes/);
  });

  it('separa as origens de CORS por vírgula', () => {
    const parsed = loadEnv({ ...base, CORS_ORIGINS: 'http://a.com, http://b.com' } as never);
    expect(parsed.corsOrigins).toEqual(['http://a.com', 'http://b.com']);
  });

  it('marca isProd só em produção', () => {
    expect(loadEnv({ ...base, NODE_ENV: 'production' } as never).isProd).toBe(true);
    expect(env.isProd).toBe(false);
  });
});
