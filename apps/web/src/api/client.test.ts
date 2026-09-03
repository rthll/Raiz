/**
 * A base das chamadas à API é a única configuração do frontend, e errá-la não
 * dá erro de build: dá 405 em produção, com a SPA servindo index.html para um
 * POST. Foi o que aconteceu com `VITE_API_URL` criada em branco no painel.
 */
import { describe, expect, it } from 'vitest';
import { baseDaApi } from './client.js';

describe('base da API', () => {
  it('usa /api quando a variável não existe', () => {
    expect(baseDaApi(undefined)).toBe('/api');
  });

  it('trata variável em branco como não configurada', () => {
    expect(baseDaApi('')).toBe('/api');
    expect(baseDaApi('   ')).toBe('/api');
  });

  it('respeita a base configurada', () => {
    expect(baseDaApi('/api')).toBe('/api');
    expect(baseDaApi('https://raiz-api.vercel.app/api')).toBe('https://raiz-api.vercel.app/api');
  });
});
