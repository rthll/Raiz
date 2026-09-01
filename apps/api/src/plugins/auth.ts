import jwt from '@fastify/jwt';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { Env } from '../env.js';

/** Conteúdo do access token. Nada sensível: só quem é e de qual household. */
export interface AccessPayload {
  sub: string;
  householdId: string;
  nome: string;
  email: string;
}

declare module 'fastify' {
  interface FastifyInstance {
    /** Pré-handler que exige um access token válido. */
    autenticar: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    /** Preenchido por `autenticar`. Acessar antes disso é erro de programação. */
    usuario: AccessPayload;
    /**
     * O escopo de TODA query. Ler daqui, nunca do corpo ou da query string —
     * é isso que impede um household de enxergar o outro.
     */
    householdId: string;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AccessPayload;
    user: AccessPayload;
  }
}

const plugin: FastifyPluginAsync<{ env: Env }> = async (app, { env }) => {
  await app.register(jwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: env.ACCESS_TOKEN_TTL },
  });

  // Decorado com null para o Fastify reservar o slot na shape do request; o
  // valor real e escrito por 'autenticar' antes de qualquer handler ler.
  app.decorateRequest('usuario', null as unknown as AccessPayload);
  app.decorateRequest('householdId', '');

  app.decorate('autenticar', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const payload = await request.jwtVerify<AccessPayload>();
      request.usuario = payload;
      request.householdId = payload.householdId;
    } catch {
      // Uma resposta só para token ausente, malformado ou expirado: não vale
      // contar ao cliente qual dos três foi.
      await reply.code(401).send({
        error: 'nao_autenticado',
        message: 'Faça login para continuar.',
      });
    }
  });
};

export const authPlugin = fp(plugin, { name: 'auth' });
