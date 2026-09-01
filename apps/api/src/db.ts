import { PrismaClient } from '@prisma/client';

/**
 * Cliente Prisma único por processo.
 *
 * Duas razões para o singleton em `globalThis`:
 * - em dev, o `tsx watch` recarrega o módulo a cada save e abriria um pool novo
 *   por reload até estourar as conexões do Postgres;
 * - em serverless, o container é reaproveitado entre invocações, e reinstanciar
 *   por requisição faria o mesmo.
 *
 * Em produção use a connection string **pooled** do Neon (a que tem `-pooler`),
 * pela mesma razão: cada container frio abre a sua conexão.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
