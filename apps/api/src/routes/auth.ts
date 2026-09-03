import type { PrismaClient } from '@prisma/client';
import { loginSchema, preferenciasSchema, registroSchema } from '@raiz/schemas';
import type { FastifyInstance } from 'fastify';
import { hashPassword, verifyPassword } from '../auth/password.js';
import {
  consumirRefreshToken,
  emitirRefreshToken,
  revogarSessao,
  revogarTodasSessoes,
} from '../auth/tokens.js';
import type { Env } from '../env.js';
import { HttpError, conflito, validar } from '../http/errors.js';
import type { AccessPayload } from '../plugins/auth.js';
import { limiteAuth, limiteRefresh, limiteRegistro } from '../plugins/seguranca.js';

const COOKIE = 'raiz_refresh';

interface Deps {
  prisma: PrismaClient;
  env: Env;
}

export async function authRoutes(app: FastifyInstance, { prisma, env }: Deps) {
  /**
   * O cookie de refresh é httpOnly (JS da página não lê) e restrito a
   * `/api/auth` — nenhuma outra rota precisa dele, então nem o recebe.
   *
   * `sameSite: 'lax'` basta porque frontend e API ficam no mesmo domínio: o
   * rewrite da Vercel serve `/api` a partir da origem do site. Fosse
   * cross-site, exigiria `none` + `secure`, com toda a fragilidade que vem junto.
   */
  const cookieOpts = {
    httpOnly: true,
    secure: env.isProd,
    sameSite: 'lax' as const,
    path: '/api/auth',
  };

  const emitirSessao = async (user: {
    id: string;
    email: string;
    nome: string;
    householdId: string;
  }) => {
    const payload: AccessPayload = {
      sub: user.id,
      householdId: user.householdId,
      nome: user.nome,
      email: user.email,
    };
    const accessToken = app.jwt.sign(payload);
    const { token, expiraEm } = await emitirRefreshToken(
      prisma,
      user.id,
      env.REFRESH_TOKEN_TTL_DIAS,
    );
    return { accessToken, refreshToken: token, expiraEm, payload };
  };

  const usuarioDTO = (u: {
    id: string;
    nome: string;
    email: string;
    householdId: string;
    preferencias: unknown;
  }) => ({
    id: u.id,
    nome: u.nome,
    email: u.email,
    householdId: u.householdId,
    preferencias: u.preferencias,
  });

  // ── registro
  app.post('/api/auth/register', { config: limiteRegistro }, async (request, reply) => {
    const dados = validar(registroSchema, request.body);

    const jaExiste = await prisma.user.findUnique({ where: { email: dados.email } });
    if (jaExiste) throw conflito('Já existe uma conta com esse e-mail.');

    const user = await prisma.$transaction(async (tx) => {
      const household = await tx.household.create({
        data: { nome: dados.household ?? `Casa de ${dados.nome}` },
      });
      return tx.user.create({
        data: {
          nome: dados.nome,
          email: dados.email,
          senhaHash: await hashPassword(dados.senha),
          householdId: household.id,
          preferencias: { modoPrivacidade: false, modoCasal: true, alertasVencimento: true },
        },
      });
    });

    const sessao = await emitirSessao(user);
    return reply
      .setCookie(COOKIE, sessao.refreshToken, { ...cookieOpts, expires: sessao.expiraEm })
      .code(201)
      .send({ accessToken: sessao.accessToken, usuario: usuarioDTO(user) });
  });

  // ── login
  app.post('/api/auth/login', { config: limiteAuth }, async (request, reply) => {
    const dados = validar(loginSchema, request.body);
    const user = await prisma.user.findUnique({ where: { email: dados.email } });

    /**
     * Sempre gastamos o tempo do scrypt, mesmo sem usuário: responder rápido
     * quando o e-mail não existe entregaria quais e-mails estão cadastrados.
     */
    const hashFalso = '$'.repeat(3);
    const senhaConfere = user
      ? await verifyPassword(dados.senha, user.senhaHash)
      : await verifyPassword(dados.senha, hashFalso);

    if (!user || !senhaConfere) {
      // Mensagem única: não revela se foi o e-mail ou a senha que errou.
      throw new HttpError(401, 'credenciais_invalidas', 'E-mail ou senha incorretos.');
    }

    const sessao = await emitirSessao(user);
    return reply
      .setCookie(COOKIE, sessao.refreshToken, { ...cookieOpts, expires: sessao.expiraEm })
      .send({ accessToken: sessao.accessToken, usuario: usuarioDTO(user) });
  });

  // ── refresh
  app.post('/api/auth/refresh', { config: limiteRefresh }, async (request, reply) => {
    const token = request.cookies[COOKIE];
    if (!token) {
      throw new HttpError(401, 'sem_sessao', 'Sessão expirada. Entre novamente.');
    }

    const resultado = await consumirRefreshToken(prisma, token);
    if (!resultado.ok) {
      if (resultado.motivo === 'reutilizado') {
        // Token já usado: possível roubo. `consumirRefreshToken` já derrubou
        // todas as sessões do usuário; aqui só limpamos o cookie.
        request.log.warn({ motivo: resultado.motivo }, 'refresh token reutilizado');
      }
      return reply
        .clearCookie(COOKIE, cookieOpts)
        .code(401)
        .send({ error: 'sessao_invalida', message: 'Sessão expirada. Entre novamente.' });
    }

    const user = await prisma.user.findUnique({ where: { id: resultado.userId } });
    if (!user) {
      return reply
        .clearCookie(COOKIE, cookieOpts)
        .code(401)
        .send({ error: 'sessao_invalida', message: 'Sessão expirada. Entre novamente.' });
    }

    const sessao = await emitirSessao(user);
    return reply
      .setCookie(COOKIE, sessao.refreshToken, { ...cookieOpts, expires: sessao.expiraEm })
      .send({ accessToken: sessao.accessToken, usuario: usuarioDTO(user) });
  });

  // ── logout
  app.post('/api/auth/logout', async (request, reply) => {
    const token = request.cookies[COOKIE];
    if (token) await revogarSessao(prisma, token);
    return reply.clearCookie(COOKIE, cookieOpts).code(204).send();
  });

  // ── encerrar todas as sessões
  app.post(
    '/api/auth/logout-all',
    { preHandler: app.autenticar },
    async (request, reply) => {
      const quantas = await revogarTodasSessoes(prisma, request.usuario.sub);
      return reply.clearCookie(COOKIE, cookieOpts).send({ sessoesEncerradas: quantas });
    },
  );

  // ── quem sou eu
  app.get('/api/auth/me', { preHandler: app.autenticar }, async (request) => {
    const user = await prisma.user.findUnique({ where: { id: request.usuario.sub } });
    if (!user) throw new HttpError(401, 'sem_sessao', 'Sessão expirada. Entre novamente.');
    return { usuario: usuarioDTO(user) };
  });

  // ── preferências (modoPrivacidade, modoCasal, alertasVencimento)
  app.patch(
    '/api/auth/preferencias',
    { preHandler: app.autenticar },
    async (request) => {
      const dados = validar(preferenciasSchema, request.body);
      const user = await prisma.user.findUnique({ where: { id: request.usuario.sub } });
      if (!user) throw new HttpError(401, 'sem_sessao', 'Sessão expirada. Entre novamente.');

      const atual = (user.preferencias ?? {}) as Record<string, unknown>;
      const atualizado = await prisma.user.update({
        where: { id: user.id },
        data: { preferencias: { ...atual, ...dados } },
      });
      return { usuario: usuarioDTO(atualizado) };
    },
  );
}
