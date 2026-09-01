import type { FastifyReply } from 'fastify';
import type { ZodError, ZodTypeAny, output } from 'zod';

/**
 * Formato único de erro da API. O frontend só precisa entender uma forma:
 * `{ error, message, campos? }`, sempre com mensagem em pt-BR pronta para exibir.
 */
export interface ApiError {
  error: string;
  message: string;
  /** Erros por campo, no formato que o react-hook-form consome. */
  campos?: Record<string, string>;
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly campos?: Record<string, string>,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const naoEncontrado = (oQue: string) =>
  new HttpError(404, 'nao_encontrado', `${oQue} não encontrado.`);

export const conflito = (message: string) => new HttpError(409, 'conflito', message);

export const invalido = (message: string, campos?: Record<string, string>) =>
  new HttpError(422, 'validacao', message, campos);

/** Achata os issues do Zod em `{ campo: mensagem }`. */
export function camposDoZod(erro: ZodError): Record<string, string> {
  const campos: Record<string, string> = {};
  for (const issue of erro.issues) {
    const chave = issue.path.join('.') || '_';
    campos[chave] ??= issue.message;
  }
  return campos;
}

/**
 * Valida corpo/query e devolve o dado tipado, ou lança um 422 já formatado.
 * Usar isto em vez do JSON Schema do Fastify mantém uma validação só — a mesma
 * dos schemas Zod compartilhados com o frontend.
 */
export function validar<S extends ZodTypeAny>(schema: S, dado: unknown): output<S> {
  const resultado = schema.safeParse(dado);
  if (!resultado.success) {
    throw invalido('Confira os campos destacados.', camposDoZod(resultado.error));
  }
  return resultado.data;
}

export function responderErro(reply: FastifyReply, erro: HttpError): FastifyReply {
  const corpo: ApiError = { error: erro.code, message: erro.message };
  if (erro.campos) corpo.campos = erro.campos;
  return reply.code(erro.status).send(corpo);
}
