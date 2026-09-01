/**
 * Testes dos diálogos de CRUD.
 *
 * O foco é o que não aparece no código à primeira vista: validação bloqueando o
 * envio, erro por campo vindo do Zod e da API, parsing pt-BR na ida, e a
 * confirmação antes de excluir.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CategoriaDialog } from './CategoriaDialog.js';
import { LancamentoDialog } from './LancamentoDialog.js';
import { MetaDialog } from './MetaDialog.js';
import { ToasterProvider } from '../ui/Toaster.js';

const CATEGORIAS = [
  { id: 'k1', nome: 'Moradia', tipo: 'SAIDA', cor: '#b2622d', orcamentoMensal: 2600, ordem: 0 },
  { id: 'k8', nome: 'Salário', tipo: 'ENTRADA', cor: '#56633f', orcamentoMensal: null, ordem: 1 },
];
const CONTAS = [{ id: 'b1', nome: 'Nubank', tipo: 'CORRENTE', dono: 'Ana', saldo: 100, ultimaSync: null }];
const CARTOES = [
  { id: 'c1', nome: 'Nubank Ultravioleta', bandeira: 'MASTERCARD', final: '4821', limite: 12000, diaFechamento: 28, diaVencimento: 8, temaEscuro: true, ordem: 0 },
];

/** Corpos enviados, para conferir o que chegaria na API. */
let enviados: Array<{ url: string; method: string; body: unknown }> = [];
/** Resposta forçada da próxima escrita, para testar erro vindo do servidor. */
let respostaDeEscrita: { status: number; corpo: unknown } | null = null;

beforeEach(() => {
  enviados = [];
  respostaDeEscrita = null;

  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const metodo = init?.method ?? 'GET';
      const caminho = url.split('?')[0]!;

      if (metodo !== 'GET') {
        enviados.push({
          url: caminho,
          method: metodo,
          body: init?.body ? JSON.parse(init.body as string) : null,
        });
        if (respostaDeEscrita) {
          return new Response(JSON.stringify(respostaDeEscrita.corpo), {
            status: respostaDeEscrita.status,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ id: 'novo' }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const dados =
        caminho === '/api/categories'
          ? CATEGORIAS
          : caminho === '/api/accounts'
            ? CONTAS
            : caminho === '/api/cards'
              ? CARTOES
              : [];
      return new Response(JSON.stringify(dados), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderizar(elemento: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={qc}>
      <ToasterProvider>{elemento}</ToasterProvider>
    </QueryClientProvider>,
  );
}

const salvar = () => screen.getByRole('button', { name: 'Salvar' });

// ────────────────────────────────────────────────────────────── validação

describe('validação antes de enviar', () => {
  it('não envia nada quando os campos obrigatórios estão vazios', async () => {
    renderizar(<LancamentoDialog aberto dataPadrao="2026-08-01" onFechar={vi.fn()} />);
    await userEvent.click(salvar());

    await waitFor(() => expect(screen.getAllByRole('alert').length).toBeGreaterThan(0));
    // Nenhuma escrita saiu — o formulário barrou antes.
    expect(enviados).toHaveLength(0);
  });

  it('mostra o erro no campo, ligado ao input por aria-describedby', async () => {
    renderizar(<MetaDialog aberto onFechar={vi.fn()} />);
    await userEvent.click(salvar());

    const campoPrazo = await screen.findByLabelText('Prazo em meses');
    await waitFor(() => expect(campoPrazo).toHaveAttribute('aria-invalid', 'true'));
    expect(campoPrazo).toHaveAccessibleDescription(/pelo menos 1 mês/i);
  });

  it('limpa o erro assim que o campo é corrigido', async () => {
    renderizar(<MetaDialog aberto onFechar={vi.fn()} />);
    await userEvent.click(salvar());

    const nome = await screen.findByLabelText('Meta');
    await waitFor(() => expect(nome).toHaveAttribute('aria-invalid', 'true'));

    await userEvent.type(nome, 'Reserva');
    await waitFor(() => expect(nome).not.toHaveAttribute('aria-invalid'));
  });

  it('recusa prazo não inteiro na meta', async () => {
    renderizar(<MetaDialog aberto onFechar={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Meta'), 'Viagem');
    await userEvent.type(screen.getByLabelText('Valor alvo'), '24.000,00');
    await userEvent.type(screen.getByLabelText('Já guardado'), '0');
    await userEvent.type(screen.getByLabelText('Prazo em meses'), '2.5');
    await userEvent.click(salvar());

    await waitFor(() => expect(enviados).toHaveLength(0));
  });
});

// ─────────────────────────────────────────────────────── envio e parsing

describe('envio', () => {
  it('converte valor pt-BR para número antes de mandar', async () => {
    renderizar(<MetaDialog aberto onFechar={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Meta'), 'Viagem ao Japão');
    await userEvent.type(screen.getByLabelText('Valor alvo'), '24.000,50');
    await userEvent.type(screen.getByLabelText('Já guardado'), '7.250,00');
    await userEvent.type(screen.getByLabelText('Prazo em meses'), '18');
    await userEvent.click(salvar());

    await waitFor(() => expect(enviados).toHaveLength(1));
    expect(enviados[0]!.method).toBe('POST');
    expect(enviados[0]!.body).toMatchObject({
      nome: 'Viagem ao Japão',
      alvo: 24000.5,
      atual: 7250,
      prazoMeses: 18,
    });
  });

  it('desmembra a origem do lançamento em accountId ou cardId', async () => {
    renderizar(<LancamentoDialog aberto dataPadrao="2026-08-01" onFechar={vi.fn()} />);
    await screen.findByRole('option', { name: 'Nubank' });

    await userEvent.type(screen.getByLabelText('Descrição'), 'Mercado');
    await userEvent.type(screen.getByLabelText('Valor'), '612,40');
    await userEvent.selectOptions(screen.getByLabelText('Categoria'), 'k1');
    await userEvent.selectOptions(screen.getByLabelText('Conta ou cartão'), 'cartao:c1');
    await userEvent.click(salvar());

    await waitFor(() => expect(enviados).toHaveLength(1));
    expect(enviados[0]!.body).toMatchObject({
      descricao: 'Mercado',
      valor: 612.4,
      accountId: null,
      cardId: 'c1',
    });
  });

  it('só oferece categorias do mesmo tipo do lançamento', async () => {
    renderizar(<LancamentoDialog aberto dataPadrao="2026-08-01" onFechar={vi.fn()} />);
    const categoria = await screen.findByLabelText('Categoria');
    // As opções só existem depois de a lista de categorias chegar.
    await within(categoria).findByRole('option', { name: 'Moradia' });

    // Tipo padrão é SAIDA: só Moradia aparece.
    expect(within(categoria).queryByRole('option', { name: 'Salário' })).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Tipo'), 'ENTRADA');
    await waitFor(() =>
      expect(within(categoria).getByRole('option', { name: 'Salário' })).toBeInTheDocument(),
    );
  });

  it('usa PUT e "Salvar alterações" ao editar', async () => {
    const existente = {
      id: 'g1',
      nome: 'Reserva',
      alvo: 30000,
      atual: 18400,
      prazoMeses: 12,
      ordem: 0,
    };
    renderizar(<MetaDialog aberto editando={existente} onFechar={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Editar meta' })).toBeInTheDocument();
    expect(screen.getByLabelText('Meta')).toHaveValue('Reserva');

    await userEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    await waitFor(() => expect(enviados).toHaveLength(1));
    expect(enviados[0]!.method).toBe('PUT');
    expect(enviados[0]!.url).toBe('/api/goals/g1');
  });

  it('fecha e avisa depois de salvar', async () => {
    const onFechar = vi.fn();
    renderizar(<MetaDialog aberto onFechar={onFechar} />);
    await userEvent.type(screen.getByLabelText('Meta'), 'Carro');
    await userEvent.type(screen.getByLabelText('Valor alvo'), '45000');
    await userEvent.type(screen.getByLabelText('Já guardado'), '0');
    await userEvent.type(screen.getByLabelText('Prazo em meses'), '24');
    await userEvent.click(salvar());

    await waitFor(() => expect(onFechar).toHaveBeenCalled());
    expect(await screen.findByText('Meta criada.')).toBeInTheDocument();
  });
});

// ──────────────────────────────────────────────────────── erros da API

describe('erros vindos da API', () => {
  it('mostra o erro por campo que a API devolve', async () => {
    respostaDeEscrita = {
      status: 422,
      corpo: {
        error: 'validacao',
        message: 'Confira os campos destacados.',
        campos: { nome: 'Já existe uma meta com esse nome.' },
      },
    };
    renderizar(<MetaDialog aberto onFechar={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Meta'), 'Reserva');
    await userEvent.type(screen.getByLabelText('Valor alvo'), '1000');
    await userEvent.type(screen.getByLabelText('Já guardado'), '0');
    await userEvent.type(screen.getByLabelText('Prazo em meses'), '12');
    await userEvent.click(salvar());

    expect(await screen.findByText('Já existe uma meta com esse nome.')).toBeInTheDocument();
  });

  it('mostra erro geral quando a falha não é de campo, e mantém o diálogo aberto', async () => {
    const onFechar = vi.fn();
    respostaDeEscrita = {
      status: 409,
      corpo: { error: 'conflito', message: 'Já existe uma categoria com esse nome.' },
    };
    renderizar(<CategoriaDialog aberto onFechar={onFechar} />);
    await userEvent.type(screen.getByLabelText('Nome'), 'Moradia');
    await userEvent.click(salvar());

    expect(await screen.findByText('Já existe uma categoria com esse nome.')).toBeInTheDocument();
    // O diálogo continua aberto para a pessoa corrigir sem redigitar tudo.
    expect(onFechar).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────── categoria

describe('CategoriaDialog', () => {
  it('trata limite vazio como "sem limite", não como zero', async () => {
    renderizar(<CategoriaDialog aberto onFechar={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Nome'), 'Pets');
    await userEvent.click(salvar());

    await waitFor(() => expect(enviados).toHaveLength(1));
    expect((enviados[0]!.body as { orcamentoMensal: unknown }).orcamentoMensal).toBeNull();
  });

  it('oferece só as 5 cores do design system', async () => {
    renderizar(<CategoriaDialog aberto onFechar={vi.fn()} />);
    const cor = screen.getByLabelText('Cor');
    expect(within(cor).getAllByRole('option')).toHaveLength(5);
  });
});
