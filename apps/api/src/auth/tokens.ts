import { createHash, randomBytes } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';

/**
 * Ciclo de vida do refresh token.
 *
 * O token é um segredo aleatório opaco, não um JWT: ele não precisa carregar
 * informação, só ser impossível de adivinhar. Guardamos o SHA-256 dele — um dump
 * do banco não vira sessão de ninguém.
 *
 * A cada refresh o token antigo é revogado e um novo é emitido (rotação). Se um
 * token já revogado for apresentado, tratamos como sinal de roubo e derrubamos
 * todas as sessões daquele usuário.
 */

export function gerarRefreshToken(): string {
  return randomBytes(48).toString('base64url');
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function validadeEm(dias: number, agora = new Date()): Date {
  return new Date(agora.getTime() + dias * 24 * 60 * 60 * 1000);
}

export interface SessaoEmitida {
  token: string;
  expiraEm: Date;
}

export async function emitirRefreshToken(
  prisma: PrismaClient,
  userId: string,
  dias: number,
): Promise<SessaoEmitida> {
  const token = gerarRefreshToken();
  const expiraEm = validadeEm(dias);
  await prisma.refreshToken.create({
    data: { userId, tokenHash: hashRefreshToken(token), expiraEm },
  });
  return { token, expiraEm };
}

export type ResultadoRefresh =
  | { ok: true; userId: string }
  | { ok: false; motivo: 'inexistente' | 'expirado' | 'reutilizado' };

/**
 * Consome um refresh token: valida, revoga e devolve o dono.
 *
 * Reuso de token já revogado derruba todas as sessões do usuário — é o
 * comportamento padrão de detecção de roubo de refresh token.
 */
export async function consumirRefreshToken(
  prisma: PrismaClient,
  token: string,
  agora = new Date(),
): Promise<ResultadoRefresh> {
  const registro = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashRefreshToken(token) },
  });

  if (!registro) return { ok: false, motivo: 'inexistente' };

  if (registro.revogadoEm) {
    await revogarTodasSessoes(prisma, registro.userId);
    return { ok: false, motivo: 'reutilizado' };
  }

  if (registro.expiraEm <= agora) return { ok: false, motivo: 'expirado' };

  await prisma.refreshToken.update({
    where: { id: registro.id },
    data: { revogadoEm: agora },
  });
  return { ok: true, userId: registro.userId };
}

/** Logout de uma sessão. Não falha se o token já não existir. */
export async function revogarSessao(prisma: PrismaClient, token: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashRefreshToken(token), revogadoEm: null },
    data: { revogadoEm: new Date() },
  });
}

export async function revogarTodasSessoes(prisma: PrismaClient, userId: string): Promise<number> {
  const { count } = await prisma.refreshToken.updateMany({
    where: { userId, revogadoEm: null },
    data: { revogadoEm: new Date() },
  });
  return count;
}

/** Limpeza dos tokens vencidos. Chamado pelo cron diário. */
export async function limparTokensExpirados(prisma: PrismaClient): Promise<number> {
  const { count } = await prisma.refreshToken.deleteMany({
    where: { expiraEm: { lt: new Date() } },
  });
  return count;
}
