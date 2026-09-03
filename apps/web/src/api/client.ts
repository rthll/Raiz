/**
 * Cliente HTTP da API.
 *
 * O access token vive **em memória**, nunca em `localStorage`. Um XSS que leia o
 * storage rouba a sessão inteira; em memória, o estrago termina quando a aba
 * fecha. Quem sustenta a sessão entre recargas é o cookie httpOnly de refresh,
 * que o JavaScript não alcança.
 */

let accessToken: string | null = null;
let aoPerderSessao: (() => void) | null = null;

export function definirAccessToken(token: string | null): void {
  accessToken = token;
}

export function aoExpirarSessao(callback: () => void): void {
  aoPerderSessao = callback;
}

/** Erro da API com a mensagem em pt-BR já pronta para exibir. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    /** Erros por campo, para o formulário destacar. */
    readonly campos?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const BASE = import.meta.env.VITE_API_URL ?? '/api';

interface Opcoes {
  method?: string;
  body?: unknown;
  /** Não tenta renovar a sessão — usado pelo próprio refresh, para não recursar. */
  semRefresh?: boolean;
}

async function executar(caminho: string, opcoes: Opcoes): Promise<Response> {
  return fetch(`${BASE}${caminho}`, {
    method: opcoes.method ?? 'GET',
    // Envia o cookie de refresh nas rotas de auth.
    credentials: 'include',
    headers: {
      ...(opcoes.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    ...(opcoes.body !== undefined ? { body: JSON.stringify(opcoes.body) } : {}),
  });
}

/**
 * Renovação em voo compartilhada.
 *
 * O dashboard dispara várias consultas de uma vez; se o token expirou, todas
 * voltam 401 juntas. Sem esta promessa compartilhada, cada uma tentaria renovar,
 * e como o refresh token **rotaciona**, a segunda tentativa usaria um token já
 * revogado — o que o servidor trata como roubo e derruba a sessão inteira.
 */
let renovacaoEmVoo: Promise<boolean> | null = null;

async function renovarSessao(): Promise<boolean> {
  renovacaoEmVoo ??= (async () => {
    try {
      const res = await executar('/auth/refresh', { method: 'POST', semRefresh: true });
      if (!res.ok) return false;
      const dados = (await res.json()) as { accessToken: string };
      accessToken = dados.accessToken;
      return true;
    } catch {
      return false;
    } finally {
      // Libera para a próxima expiração, seja qual for o resultado desta.
      queueMicrotask(() => {
        renovacaoEmVoo = null;
      });
    }
  })();
  return renovacaoEmVoo;
}

async function interpretar<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;

  const texto = await res.text();
  const dados: unknown = texto ? JSON.parse(texto) : null;

  if (!res.ok) {
    const corpo = (dados ?? {}) as { error?: unknown; message?: unknown; campos?: Record<string, string> };

    /*
     * Nem todo erro vem da nossa API. A proteção de deployment da Vercel
     * responde `{ error: { message, code } }` — JSON válido, formato alheio —
     * e um proxy no meio pode responder qualquer outra coisa. Quando a
     * mensagem não vier no formato esperado, o status vai junto: sem ele,
     * "não foi possível" não diz a ninguém o que aconteceu, e foi assim que um
     * 401 de porta errada virou meia hora de investigação.
     */
    const codigo = typeof corpo.error === 'string' ? corpo.error : 'erro';
    const mensagem =
      typeof corpo.message === 'string'
        ? corpo.message
        : `Não foi possível concluir a operação (HTTP ${res.status}).`;

    throw new ApiError(res.status, codigo, mensagem, corpo.campos);
  }
  return dados as T;
}

export async function api<T>(caminho: string, opcoes: Opcoes = {}): Promise<T> {
  let res = await executar(caminho, opcoes);

  if (res.status === 401 && !opcoes.semRefresh) {
    const renovou = await renovarSessao();
    if (renovou) {
      res = await executar(caminho, opcoes);
    } else {
      accessToken = null;
      aoPerderSessao?.();
    }
  }

  return interpretar<T>(res);
}

export const get = <T>(caminho: string) => api<T>(caminho);
export const post = <T>(caminho: string, body?: unknown) => api<T>(caminho, { method: 'POST', body });
export const put = <T>(caminho: string, body: unknown) => api<T>(caminho, { method: 'PUT', body });
export const patch = <T>(caminho: string, body: unknown) =>
  api<T>(caminho, { method: 'PATCH', body });
export const del = (caminho: string) => api<void>(caminho, { method: 'DELETE' });
