/**
 * Teste de fumaça do aplicativo inteiro.
 *
 * As telas já são testadas isoladamente, mas ninguém montava `App` — que é onde
 * vivem o portão de sessão, os providers e o router. Uma falha aqui é a tela
 * branca: o React desmonta tudo e não sobra nada no DOM.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.js';

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      // Sem sessão: é o estado de quem abre o app pela primeira vez.
      if (String(url).includes('/auth/refresh')) {
        return new Response(JSON.stringify({ error: 'sem_sessao', message: 'Entre.' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={qc}>
      <App />
    </QueryClientProvider>,
  );
}

describe('App', () => {
  it('monta sem estourar e mostra o login quando não há sessão', async () => {
    montar();
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    expect(screen.getByLabelText('E-mail')).toBeInTheDocument();
    expect(screen.getByLabelText('Senha')).toBeInTheDocument();
  });

  it('não deixa a página em branco: sempre há conteúdo no DOM', async () => {
    const { container } = montar();
    await waitFor(() => expect(container.textContent?.trim().length).toBeGreaterThan(0));
  });
});
