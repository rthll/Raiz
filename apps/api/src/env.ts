import { z } from 'zod';

/**
 * Configuração da API. Falhar aqui, no boot, é melhor do que descobrir uma
 * variável faltando na primeira requisição em produção.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3333),
  /** Origens autorizadas no CORS, separadas por vírgula. */
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().url(),

  /**
   * Dois segredos distintos de propósito: se o de acesso vazar, ele não serve
   * para forjar um refresh token e manter a sessão viva indefinidamente.
   */
  JWT_SECRET: z.string().min(32, 'precisa de pelo menos 32 caracteres'),
  JWT_REFRESH_SECRET: z.string().min(32, 'precisa de pelo menos 32 caracteres'),

  /** Segredo do cron diário. Sem ele, a rota /api/cron/daily recusa tudo. */
  CRON_SECRET: z.string().min(16).optional(),

  /** Vida do access token. Curta de propósito — o refresh é quem sustenta a sessão. */
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DIAS: z.coerce.number().int().positive().default(30),
});

export type Env = z.infer<typeof schema> & { corsOrigins: string[]; isProd: boolean };

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const detalhes = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Variáveis de ambiente inválidas:\n${detalhes.join('\n')}`);
  }
  if (parsed.data.JWT_SECRET === parsed.data.JWT_REFRESH_SECRET) {
    throw new Error('JWT_SECRET e JWT_REFRESH_SECRET precisam ser diferentes.');
  }
  return {
    ...parsed.data,
    isProd: parsed.data.NODE_ENV === 'production',
    corsOrigins: parsed.data.CORS_ORIGINS.split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  };
}
