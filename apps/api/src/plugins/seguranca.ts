import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { Env } from '../env.js';

/**
 * Endurecimento para produção: cabeçalhos de segurança e limite de tentativas.
 *
 * Nada disso importa em desenvolvimento, mas sem os dois a API exposta na
 * internet fica aberta a força bruta de senha e a alguns ataques de navegador.
 */
const plugin: FastifyPluginAsync<{ env: Env }> = async (app, { env }) => {
  await app.register(helmet, {
    /*
     * A API só devolve JSON, nunca HTML. Uma CSP que proíbe tudo é o certo aqui:
     * se alguém conseguir fazer o navegador renderizar uma resposta nossa como
     * página, ela não poderá carregar script, imagem nem iframe.
     */
    contentSecurityPolicy: {
      directives: { 'default-src': ["'none'"], 'frame-ancestors': ["'none'"] },
    },
    // O frontend vive em outro projeto; nada aqui precisa ser embutido.
    crossOriginResourcePolicy: { policy: 'same-site' },
    hsts: env.isProd ? { maxAge: 31_536_000, includeSubDomains: true } : false,
  });

  await app.register(rateLimit, {
    global: false,
    /*
     * A chave é o IP real. `trustProxy` já está ligado no Fastify, então
     * `request.ip` respeita o X-Forwarded-For que a Vercel injeta — sem isso,
     * todo mundo compartilharia o IP do proxy e um único atacante bloquearia
     * o sistema inteiro.
     */
    keyGenerator: (request: FastifyRequest) => request.ip,
    /*
     * O `statusCode` vai explícito no objeto.
     *
     * O plugin entrega o retorno daqui ao error handler da aplicação como um
     * objeto simples — sem `statusCode`, e sem ter mexido em `reply.statusCode`.
     * Um handler que caia no 500 padrão transformaria o 429 em erro de servidor
     * e o cliente perderia a instrução de quando tentar de novo.
     */
    errorResponseBuilder: (_request, contexto) => ({
      statusCode: 429,
      error: 'muitas_tentativas',
      message: `Muitas tentativas. Tente de novo em ${Math.ceil(contexto.ttl / 1000)} segundos.`,
    }),
  });
};

export const segurancaPlugin = fp(plugin, { name: 'seguranca' });

/**
 * Limite para as rotas de autenticação.
 *
 * Cinco tentativas por minuto por IP: folgado para quem errou a senha, apertado
 * para quem está varrendo senhas. Aplicado por rota, não globalmente — o resto
 * da API já exige token válido.
 */
export const limiteAuth = {
  rateLimit: { max: 5, timeWindow: '1 minute' },
};

/**
 * O refresh não é alvo de adivinhação — o token é um segredo de 48 bytes — mas
 * um limite protege de alguém martelar a rota. Mais folgado que o do login
 * porque a aplicação chama refresh sozinha, no boot e a cada 15 minutos, e uma
 * casa inteira sai pelo mesmo IP.
 */
export const limiteRefresh = {
  rateLimit: { max: 20, timeWindow: '1 minute' },
};

/** Registro é mais caro (cria household + hash) e mais raro. */
export const limiteRegistro = {
  rateLimit: { max: 3, timeWindow: '10 minutes' },
};
