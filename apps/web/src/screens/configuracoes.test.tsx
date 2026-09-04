/**
 * Testes da tela de configurações.
 *
 * As três preferências já existiam no modelo e na API; o que faltava era
 * alguém chamá-las. O foco aqui é justamente esse fio: o interruptor manda o
 * PATCH certo, e o estado na tela reflete o que está salvo.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../auth/AuthProvider.js';
import { CompetenciaProvider } from '../state/competencia.js';
import { ToasterProvider } from '../ui/Toaster.js';
import { Configuracoes } from './Configuracoes.js';

const USUARIO = {
  id: 'u1',
  nome: 'Rythielly',
  email: 'r@example.com',
  householdId: 'h1',
  preferencias: { modoPrivacidade: false, modoCasal: true, alertasVencimento: true },
};

let enviados: Array<{ metodo: string; caminho: string; body: unknown }> = [];

beforeEach(() => {
  enviados = [];

  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const caminho = String(url).split('?')[0]!;
      const metodo = init?.method ?? 'GET';

      // Sessão já existente: é o estado de quem abre a tela de configurações.
      if (caminho.endsWith('/auth/refresh')) {
        return new Response(JSON.stringify({ accessToken: 'tok', usuario: USUARIO }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (caminho.endsWith('/auth/preferencias')) {
        const body = init?.body ? JSON.parse(init.body as string) : null;
        enviados.push({ metodo, caminho, body });
        return new Response(
          JSON.stringify({
            usuario: { ...USUARIO, preferencias: { ...USUARIO.preferencias, ...body } },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
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
      <AuthProvider>
        <ToasterProvider>
          <CompetenciaProvider>
            <main>
              <Configuracoes />
            </main>
          </CompetenciaProvider>
        </ToasterProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

/** O segmentado de uma preferência, achado pelo rótulo do grupo. */
function interruptor(titulo: string) {
  return screen.getByRole('radiogroup', { name: titulo });
}

describe('configurações', () => {
  it('mostra as três preferências e a conta', async () => {
    montar();
    expect(await screen.findByText('r@example.com')).toBeInTheDocument();
    for (const titulo of ['Modo casal', 'Modo privacidade', 'Alertas de vencimento']) {
      expect(interruptor(titulo)).toBeInTheDocument();
    }
  });

  it('reflete o que está salvo', async () => {
    montar();
    await screen.findByText('r@example.com');
    // modoCasal e alertas ligados, privacidade desligada — como no USUARIO.
    expect(within(interruptor('Modo casal')).getByLabelText('Ligado')).toBeChecked();
    expect(within(interruptor('Modo privacidade')).getByLabelText('Desligado')).toBeChecked();
  });

  it('desligar o modo casal manda o PATCH certo', async () => {
    const pessoa = userEvent.setup();
    montar();
    await screen.findByText('r@example.com');

    await pessoa.click(within(interruptor('Modo casal')).getByLabelText('Desligado'));

    await waitFor(() => expect(enviados).toHaveLength(1));
    expect(enviados[0]).toMatchObject({
      metodo: 'PATCH',
      body: { modoCasal: false },
    });
  });

  it('avisa quando não consegue salvar', async () => {
    const pessoa = userEvent.setup();
    montar();
    await screen.findByText('r@example.com');

    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: 'erro', message: 'Falhou.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );

    await pessoa.click(within(interruptor('Modo privacidade')).getByLabelText('Ligado'));
    expect(await screen.findByText('Não foi possível salvar a preferência.')).toBeInTheDocument();
  });
});
