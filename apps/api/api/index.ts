import type { IncomingMessage, ServerResponse } from 'node:http';
import { buildApp } from '../src/app.js';

/**
 * Entrada da Vercel Function.
 *
 * O Fastify não é um handler `(req, res)` — ele é um servidor HTTP. O padrão
 * suportado é subir a instância uma vez por container frio e delegar cada
 * requisição ao seu servidor interno via `emit('request')`, sem abrir socket.
 */
const app = buildApp({ logger: false });
const ready = app.ready();

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  await ready;
  app.server.emit('request', req, res);
}
