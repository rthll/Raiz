import { timingSafeEqual } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { limparTokensExpirados } from '../auth/tokens.js';
import type { Env } from '../env.js';
import { HttpError } from '../http/errors.js';
import { gerarRecorrentes, levantarAlertas } from '../jobs/recorrencias.js';

interface Deps {
  prisma: PrismaClient;
  env: Env;
}

/**
 * Job diário.
 *
 * Não passa pelo `autenticar`: quem chama é o cron da Vercel, que não tem
 * sessão. A porta é fechada por um segredo no header, comparado em tempo
 * constante — sem isso, qualquer um na internet dispararia a geração de
 * lançamentos do sistema inteiro.
 */
export async function cronRoutes(app: FastifyInstance, { prisma, env }: Deps) {
  const autorizado = (recebido: string | undefined): boolean => {
    if (!env.CRON_SECRET || !recebido) return false;
    const a = Buffer.from(recebido);
    const b = Buffer.from(env.CRON_SECRET);
    // timingSafeEqual exige mesmo tamanho; comparar o tamanho antes não vaza
    // mais do que o próprio comprimento do header.
    return a.length === b.length && timingSafeEqual(a, b);
  };

  app.post('/api/cron/daily', async (request) => {
    // A Vercel manda `Authorization: Bearer <CRON_SECRET>`.
    const header = request.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!autorizado(header)) {
      throw new HttpError(401, 'nao_autorizado', 'Chamada de cron não autorizada.');
    }

    const inicio = Date.now();
    const recorrencias = await gerarRecorrentes(prisma);
    const alertas = await levantarAlertas(prisma);
    const tokensRemovidos = await limparTokensExpirados(prisma);

    request.log.info(
      { recorrencias, alertas: alertas.length, tokensRemovidos },
      'cron diário concluído',
    );

    return {
      duracaoMs: Date.now() - inicio,
      recorrencias,
      tokensRemovidos,
      // Os alertas são devolvidos, não enviados: ainda não há canal de
      // notificação. O dashboard mostra os mesmos avisos na tela.
      alertas,
    };
  });
}
