/**
 * Testes do portão de sessão.
 *
 * O cadastro é a única porta de entrada de um banco vazio — foi a falta dele que
 * deixou o primeiro deploy de produção inacessível, com a API pronta e ninguém
 * capaz de criar a primeira conta. O foco aqui é o contrato: o que o formulário
 * manda para a API, e o que ele faz com o que volta.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App.js';
import { AuthProvider } from './AuthProvider.js';
import { Registro } from './Registro.js';

const USUARIO = {
  id: 'u1',
  nome: 'Ana',
  email: 'ana@raiz.app',
  householdId: 'h1',
  preferencias: { modoPrivacidade: false, modoCasal: true, alertasVencimento: true },
};

/** Corpos enviados ao registro, para conferir o que chegaria na API. */
let enviados: unknown[] = [];
/** Resposta forçada do registro, para testar o erro vindo do servidor. */
let respostaDoRegistro: { status: number; corpo: unknown } | null = null;

beforeEach(() => {
  enviados = [];
  respostaDoRegistro = null;

  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const caminho = String(url).split('?')[0]!;

      // Sem cookie de refresh: o estado de quem abre o app pela primeira vez.
      if (caminho.endsWith('/auth/refresh')) {
        return new Response(JSON.stringify({ error: 'sem_sessao', message: 'Entre.' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (caminho.endsWith('/auth/register')) {
        enviados.push(init?.body ? JSON.parse(init.body as string) : null);
        const resposta = respostaDoRegistro ?? {
          status: 201,
          corpo: { accessToken: 'token-novo', usuario: USUARIO },
        };
        return new Response(JSON.stringify(resposta.corpo), {
          status: resposta.status,
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

function montar(tela: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={qc}>
      <AuthProvider>{tela}</AuthProvider>
    </QueryClientProvider>,
  );
}

async function preencher(pessoa: ReturnType<typeof userEvent.setup>, senha = 'raiz1234') {
  await pessoa.type(screen.getByLabelText('Nome'), 'Ana');
  await pessoa.type(screen.getByLabelText('E-mail'), 'ana@raiz.app');
  await pessoa.type(screen.getByLabelText('Senha'), senha);
}

describe('cadastro', () => {
  it('envia o cadastro e omite a casa deixada em branco', async () => {
    const pessoa = userEvent.setup();
    montar(<Registro />);
    await preencher(pessoa);
    await pessoa.click(screen.getByRole('button', { name: 'Criar conta' }));

    await waitFor(() => expect(enviados).toHaveLength(1));
    // Sem `household`: a API nomeia a casa a partir do nome de quem se cadastrou.
    expect(enviados[0]).toEqual({ nome: 'Ana', email: 'ana@raiz.app', senha: 'raiz1234' });
  });

  it('leva o nome da casa quando informado', async () => {
    const pessoa = userEvent.setup();
    montar(<Registro />);
    await preencher(pessoa);
    await pessoa.type(screen.getByLabelText('Nome da casa'), 'Casa da Ana e do Bruno');
    await pessoa.click(screen.getByRole('button', { name: 'Criar conta' }));

    await waitFor(() => expect(enviados).toHaveLength(1));
    expect(enviados[0]).toMatchObject({ household: 'Casa da Ana e do Bruno' });
  });

  it('não envia nada com senha curta demais e aponta o campo', async () => {
    const pessoa = userEvent.setup();
    montar(<Registro />);
    await preencher(pessoa, 'curta');
    await pessoa.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(
      await screen.findByText('A senha precisa de pelo menos 8 caracteres.'),
    ).toBeInTheDocument();
    expect(enviados).toHaveLength(0);
  });

  it('mostra o conflito de e-mail já cadastrado', async () => {
    respostaDoRegistro = {
      status: 409,
      corpo: { error: 'conflito', message: 'Já existe uma conta com esse e-mail.' },
    };
    const pessoa = userEvent.setup();
    montar(<Registro />);
    await preencher(pessoa);
    await pessoa.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Já existe uma conta com esse e-mail.',
    );
  });
});

describe('portão', () => {
  it('alterna entre entrar e criar conta sem sair da tela', async () => {
    const pessoa = userEvent.setup();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    render(
      <QueryClientProvider client={qc}>
        <App />
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();

    // O cadastro vem sob demanda: o heading só existe depois do pedaço chegar.
    await pessoa.click(screen.getByRole('button', { name: 'Criar conta' }));
    expect(await screen.findByRole('heading', { name: 'Criar conta' })).toBeInTheDocument();
    expect(screen.getByLabelText('Nome')).toBeInTheDocument();

    await pessoa.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
  });
});
