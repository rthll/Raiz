/**
 * Testes das telas.
 *
 * Cada tela é renderizada com a API mockada e conferida contra os números dos
 * screenshots do handoff. O que se verifica aqui é o que a tela **mostra** —
 * incluindo os estados que o protótipo não desenhou (vazio, carregando, erro).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PrivacyProvider } from '@raiz/ui';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { Assinaturas } from './Assinaturas.js';
import { Cartoes } from './Cartoes.js';
import { Categorias } from './Categorias.js';
import { Contas } from './Contas.js';
import { Dashboard } from './Dashboard.js';
import { Investimentos } from './Investimentos.js';
import { Lancamentos } from './Lancamentos.js';
import { Metas } from './Metas.js';
import { Relatorios } from './Relatorios.js';
import { CompetenciaProvider } from '../state/competencia.js';

// ─────────────────────────────────────────────── dados do seed do protótipo

const CATEGORIAS = [
  { id: 'k1', nome: 'Moradia', tipo: 'SAIDA', cor: '#b2622d', orcamentoMensal: 2600, ordem: 0 },
  { id: 'k2', nome: 'Alimentação', tipo: 'SAIDA', cor: '#d67f48', orcamentoMensal: 1500, ordem: 1 },
  { id: 'k4', nome: 'Saúde', tipo: 'SAIDA', cor: '#8fa073', orcamentoMensal: 700, ordem: 2 },
  { id: 'k8', nome: 'Salário', tipo: 'ENTRADA', cor: '#56633f', orcamentoMensal: null, ordem: 3 },
];

const CONTAS = [
  { id: 'b1', nome: 'Nubank', tipo: 'CORRENTE', dono: 'Ana', saldo: 6420.8, ultimaSync: null },
  { id: 'b2', nome: 'Itaú', tipo: 'CONJUNTA', dono: 'Ana e Bruno', saldo: 12310.45, ultimaSync: null },
  { id: 'b3', nome: 'Reserva', tipo: 'POUPANCA', dono: 'Conjunta', saldo: 3150, ultimaSync: null },
];

const CARTOES = [
  { id: 'c1', nome: 'Nubank Ultravioleta', bandeira: 'MASTERCARD', final: '4821', limite: 12000, diaFechamento: 28, diaVencimento: 8, temaEscuro: true, ordem: 0 },
  { id: 'c2', nome: 'Itaú Click', bandeira: 'VISA', final: '9033', limite: 8000, diaFechamento: 2, diaVencimento: 12, temaEscuro: false, ordem: 1 },
];

const DASHBOARD = {
  competencia: '2026-08',
  kpis: {
    saldoContas: 21881.25,
    entradas: 14400,
    saidas: 7783.7,
    saldoDoMes: 6616.3,
    investido: 142800,
    patrimonio: 164681.25,
    custoAssinaturas: 380.1,
    totalFaturas: 2613,
  },
  gastoPorCategoria: [
    {
      categoria: CATEGORIAS[0],
      gasto: 4769.9,
      quantidade: 4,
      orcamento: { gasto: 4769.9, limite: 2600, pct: 183.45, estourou: true, temLimite: true },
    },
    {
      categoria: CATEGORIAS[1],
      gasto: 947.6,
      quantidade: 3,
      orcamento: { gasto: 947.6, limite: 1500, pct: 63.17, estourou: false, temLimite: true },
    },
  ],
  vencimentos: [
    { tipo: 'assinatura', nome: 'Academia', detalhe: 'mensal · Itaú Click', valor: 129, data: '2026-09-02', destaque: false },
    { tipo: 'fatura', nome: 'Fatura Nubank Ultravioleta', detalhe: 'vence dia 8', valor: 1910.2, data: '2026-08-08', destaque: true },
  ],
  divisaoCasal: {
    porResponsavel: [
      { responsavel: 'ANA', gasto: 1246.9, percentual: 16.02 },
      { responsavel: 'BRUNO', gasto: 1098.8, percentual: 14.12 },
      { responsavel: 'CONJUNTA', gasto: 5438, percentual: 69.86 },
    ],
    acerto: 74.05,
  },
  investimentos: { total: 142800, taxaMediaPonderada: 11.010154, aporteMensal: 1700 },
  alertas: {
    testeGratis: { nome: 'App de meditação', data: '2026-09-06', passaACustar: 49.9 },
    faturaFechando: { nome: 'Nubank Ultravioleta', dia: 28 },
  },
};

const LANCAMENTOS = {
  itens: [
    { id: 't1', data: '2026-08-01', descricao: 'Salário Ana', valor: 7400, tipo: 'ENTRADA', categoriaId: 'k8', accountId: 'b2', cardId: null, responsavel: 'ANA', parcelaAtual: null, parcelaTotal: null, recurrenceId: 'r1', recorrente: true },
    { id: 't3', data: '2026-08-05', descricao: 'Aluguel', valor: 2200, tipo: 'SAIDA', categoriaId: 'k1', accountId: 'b2', cardId: null, responsavel: 'CONJUNTA', parcelaAtual: null, parcelaTotal: null, recurrenceId: null, recorrente: false },
    { id: 't11', data: '2026-08-17', descricao: 'Notebook', valor: 389.9, tipo: 'SAIDA', categoriaId: 'k1', accountId: null, cardId: 'c1', responsavel: 'BRUNO', parcelaAtual: 3, parcelaTotal: 10, recurrenceId: null, recorrente: false },
  ],
  resumo: { exibidos: 3, total: 17, entradas: 7400, saidas: 2589.9, saldo: 4810.1 },
};

const FATURA_C1 = {
  cartao: CARTOES[0],
  competencia: '2026-08',
  fechamento: '2026-08-28',
  vencimento: '2026-09-08',
  total: 1910.2,
  limite: 12000,
  usoDoLimite: 15.92,
  paga: false,
  pagaEm: null,
  itens: [LANCAMENTOS.itens[2]],
  assinaturasVinculadas: { quantidade: 4, custoMensal: 198.3 },
  parcelasEmAndamento: 1,
};

const ATIVOS = [
  { id: 'a1', nome: 'Tesouro IPCA+ 2035', classe: 'RENDA_FIXA', valor: 42000, taxaAnual: 11.2, aporteMensal: 400, metaTaxa: 10, ordem: 0 },
  { id: 'a2', nome: 'CDB liquidez diária', classe: 'RENDA_FIXA', valor: 18500, taxaAnual: 10.4, aporteMensal: 300, metaTaxa: 10, ordem: 1 },
  { id: 'a3', nome: 'FII de logística', classe: 'FUNDOS_IMOBILIARIOS', valor: 26300, taxaAnual: 8.6, aporteMensal: 250, metaTaxa: 9.5, ordem: 2 },
  { id: 'a4', nome: 'ETF S&P 500', classe: 'ACOES_EXTERIOR', valor: 31700, taxaAnual: 12.5, aporteMensal: 500, metaTaxa: 11, ordem: 3 },
  { id: 'a5', nome: 'Carteira de ações BR', classe: 'ACOES_BRASIL', valor: 14900, taxaAnual: 9.8, aporteMensal: 150, metaTaxa: 11, ordem: 4 },
  { id: 'a6', nome: 'Bitcoin', classe: 'CRIPTO', valor: 9400, taxaAnual: 15, aporteMensal: 100, metaTaxa: 12, ordem: 5 },
];

const METAS = [
  { id: 'g1', nome: 'Reserva de emergência', alvo: 30000, atual: 18400, prazoMeses: 12, ordem: 0, progresso: 61.333, guardarPorMes: 966.67, atingida: false },
  { id: 'g2', nome: 'Viagem ao Japão', alvo: 24000, atual: 7250, prazoMeses: 18, ordem: 1, progresso: 30.2, guardarPorMes: 930.56, atingida: false },
];

const ORCAMENTOS = {
  competencia: '2026-08',
  itens: [
    { categoria: CATEGORIAS[0], gasto: 4769.9, limite: 2600, pct: 183.45, estourou: true, temLimite: true },
    { categoria: CATEGORIAS[2], gasto: 738.3, limite: 700, pct: 105.47, estourou: true, temLimite: true },
    { categoria: CATEGORIAS[1], gasto: 947.6, limite: 1500, pct: 63.17, estourou: false, temLimite: true },
  ],
  limiteSomado: 6980,
  gastoSomado: 7783.7,
  estourados: 2,
};

const RELATORIOS = {
  competencia: '2026-08',
  kpis: { taxaPoupanca: 45.94, custoFixo: 6117.9, custoVariavel: 1665.8, mesesDeReserva: 2.36, reserva: 18400 },
  maioresCategorias: [
    { categoria: CATEGORIAS[0], gasto: 4769.9 },
    { categoria: CATEGORIAS[1], gasto: 947.6 },
  ],
  assinaturasAtivas: 7,
  entradas: 14400,
  saidas: 7783.7,
};

const ASSINATURAS = [
  { id: 's1', nome: 'Streaming de vídeo', valor: 55.9, periodo: 'MENSAL', proximoDebito: '2026-09-05', cardId: 'c1', categoriaId: 'k2', status: 'ATIVA', observacao: 'Plano família', precoAnterior: null },
  { id: 's5', nome: 'Suíte de design', valor: 1290, periodo: 'ANUAL', proximoDebito: '2026-11-18', cardId: 'c1', categoriaId: 'k2', status: 'ATIVA', observacao: null, precoAnterior: null },
  { id: 's7', nome: 'Jornal digital', valor: 119.7, periodo: 'TRIMESTRAL', proximoDebito: '2026-09-30', cardId: 'c2', categoriaId: 'k2', status: 'PAUSADA', observacao: null, precoAnterior: null },
];

const RESUMO_ASSINATURAS = {
  custoMensal: 380.1,
  custoAnual: 4561.2,
  ativas: 7,
  pausadas: 1,
  pctRenda: 2.64,
  maisCara: { nome: 'Academia', mensal: 129 },
};

const CASHFLOW = {
  ate: '2026-08',
  meses: [
    { mes: '2026-07', entradas: 14200, saidas: 9310 },
    { mes: '2026-08', entradas: 14400, saidas: 7783.7 },
  ],
};

const REGRAS = [{ id: 'x1', termo: 'SUPERMERC', categoriaId: 'k2', acertos: 14, ordem: 0 }];

// ─────────────────────────────────────────────────────────── infraestrutura

/** Rotas conhecidas → resposta. Uma rota fora daqui derruba o teste de propósito. */
const ROTAS: Record<string, unknown> = {
  '/api/dashboard': DASHBOARD,
  '/api/transactions': LANCAMENTOS,
  '/api/categories': CATEGORIAS,
  '/api/accounts': CONTAS,
  '/api/cards': CARTOES,
  '/api/cards/c1/invoice': FATURA_C1,
  '/api/cards/c2/invoice': { ...FATURA_C1, cartao: CARTOES[1], total: 702.8, itens: [] },
  '/api/subscriptions': ASSINATURAS,
  '/api/subscriptions/summary': RESUMO_ASSINATURAS,
  '/api/assets': ATIVOS,
  '/api/goals/progress': METAS,
  '/api/budgets': ORCAMENTOS,
  '/api/reports': RELATORIOS,
  '/api/cashflow': CASHFLOW,
  '/api/rules': REGRAS,
};

let falhar = false;

beforeEach(() => {
  falhar = false;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const caminho = url.split('?')[0]!;
      if (falhar) return new Response('{"error":"internal_error","message":"Erro interno."}', { status: 500 });

      const dados = ROTAS[caminho];
      if (dados === undefined) {
        return new Response('{"error":"not_found","message":"Rota não existe."}', { status: 404 });
      }
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

function renderizar(tela: ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <PrivacyProvider ativo={false}>
        <CompetenciaProvider>
          <MemoryRouter>{tela}</MemoryRouter>
        </CompetenciaProvider>
      </PrivacyProvider>
    </QueryClientProvider>,
  );
}

// ────────────────────────────────────────────────────────────── Visão geral

describe('Visão geral', () => {
  it('mostra os 4 KPIs com os valores dos screenshots', async () => {
    renderizar(<Dashboard />);
    expect(await screen.findByText('R$ 21.881,25')).toBeInTheDocument();
    expect(screen.getByText('R$ 14.400,00')).toBeInTheDocument();
    expect(screen.getByText('R$ 7.783,70')).toBeInTheDocument();
    expect(screen.getByText('R$ 164.681')).toBeInTheDocument();
  });

  it('lista as categorias com maior gasto, da maior para a menor', async () => {
    renderizar(<Dashboard />);
    expect(await screen.findByText('Moradia')).toBeInTheDocument();
    expect(screen.getByText('R$ 4.769,90')).toBeInTheDocument();
  });

  it('avisa do teste grátis e da fatura fechando', async () => {
    renderizar(<Dashboard />);
    const alerta = await screen.findByRole('status');
    expect(alerta).toHaveTextContent(/App de meditação sai do teste grátis em 06\/09/);
    expect(alerta).toHaveTextContent(/passa a custar 49,90/);
    expect(alerta).toHaveTextContent(/fatura do Nubank Ultravioleta fecha no dia 28/);
  });

  it('mostra o acerto do casal na direção certa', async () => {
    renderizar(<Dashboard />);
    // Ana gastou mais que Bruno, então Bruno transfere para Ana.
    expect(await screen.findByText(/Bruno transfere/)).toBeInTheDocument();
  });

  it('mostra esqueleto enquanto carrega', () => {
    const { container } = renderizar(<Dashboard />);
    expect(container.querySelectorAll('.raiz-skeleton').length).toBeGreaterThan(0);
  });

  it('mostra erro com opção de tentar de novo quando a API falha', async () => {
    falhar = true;
    renderizar(<Dashboard />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────── Lançamentos

describe('Lançamentos', () => {
  it('monta a tabela com as colunas do handoff', async () => {
    renderizar(<Lancamentos />);
    const tabela = await screen.findByRole('table');
    for (const coluna of ['Data', 'Descrição', 'Categoria', 'Conta/cartão', 'Responsável', 'Valor']) {
      expect(within(tabela).getByRole('columnheader', { name: coluna })).toBeInTheDocument();
    }
  });

  it('formata data como dd/MM e assina entradas e saídas', async () => {
    renderizar(<Lancamentos />);
    expect(await screen.findByText('01/08')).toBeInTheDocument();
    expect(screen.getByText('+ R$ 7.400,00')).toBeInTheDocument();
    expect(screen.getByText('– R$ 2.200,00')).toBeInTheDocument();
  });

  it('resolve a origem para o nome da conta ou do cartão', async () => {
    renderizar(<Lancamentos />);
    expect(await screen.findAllByText('Itaú')).toBeTruthy();
    expect(screen.getByText('Nubank Ultravioleta')).toBeInTheDocument();
  });

  it('marca lançamento recorrente e parcela', async () => {
    renderizar(<Lancamentos />);
    expect(await screen.findByText('recorrente')).toBeInTheDocument();
    expect(screen.getByText('3/10')).toBeInTheDocument();
  });

  it('mostra o resumo "N de M lançamentos · saldo do mês"', async () => {
    renderizar(<Lancamentos />);
    expect(
      await screen.findByText(/3 de 17 lançamentos · saldo do mês R\$ 4\.810,10/),
    ).toBeInTheDocument();
  });

  it('envia os filtros combinados para a API', async () => {
    renderizar(<Lancamentos />);
    await screen.findByRole('table');

    await userEvent.click(screen.getByRole('radio', { name: 'Saídas' }));
    await waitFor(() => {
      const chamadas = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.map(
        (c) => c[0] as string,
      );
      expect(chamadas.some((u) => u.includes('tipo=SAIDA'))).toBe(true);
    });
  });
});

// ────────────────────────────────────────────────────────────── Categorias

describe('Categorias', () => {
  it('mostra o chip de estouro na Moradia e o normal na Alimentação', async () => {
    renderizar(<Categorias />);
    expect(await screen.findByText('183%')).toBeInTheDocument();
    expect(screen.getByText('63%')).toBeInTheDocument();
  });

  it('mostra "sem limite" para categoria de entrada', async () => {
    renderizar(<Categorias />);
    expect(await screen.findByText('Salário')).toBeInTheDocument();
    expect(screen.getByText(/sem limite/)).toBeInTheDocument();
  });

  it('lista as regras de classificação automática', async () => {
    renderizar(<Categorias />);
    expect(await screen.findByText('SUPERMERC')).toBeInTheDocument();
    expect(screen.getByText('14 lançamentos')).toBeInTheDocument();
  });
});

// ───────────────────────────────────────────────────────────── Assinaturas

describe('Assinaturas', () => {
  it('mostra os 4 KPIs de custo', async () => {
    renderizar(<Assinaturas />);
    expect(await screen.findByText('R$ 380,10')).toBeInTheDocument();
    expect(screen.getByText('R$ 4.561')).toBeInTheDocument();
  });

  it('mensaliza a anual em vez de mostrar o valor cheio', async () => {
    renderizar(<Assinaturas />);
    // R$ 1.290 anuais = R$ 107,50 por mês.
    expect(await screen.findByText(/Equivale a R\$ 107,50 por mês/)).toBeInTheDocument();
  });

  it('oferece Pausar para ativa e Reativar para pausada', async () => {
    renderizar(<Assinaturas />);
    await screen.findByText('Streaming de vídeo');
    expect(screen.getAllByRole('button', { name: 'Pausar' })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Reativar' })).toBeInTheDocument();
  });

  it('marca o status de cada assinatura', async () => {
    renderizar(<Assinaturas />);
    expect(await screen.findByText('Pausada')).toBeInTheDocument();
    expect(screen.getAllByText('Ativa')).toHaveLength(2);
  });
});

// ─────────────────────────────────────────────────────── Cartões e faturas

describe('Cartões e faturas', () => {
  it('seleciona o primeiro cartão e mostra a fatura dele', async () => {
    renderizar(<Cartoes />);
    const cartao = await screen.findByRole('button', { name: /Nubank Ultravioleta/ });
    expect(cartao).toHaveAttribute('aria-pressed', 'true');
    const fatura = await screen.findByRole('region', { name: 'Fatura de Nubank Ultravioleta' });
    expect(within(fatura).getByText('R$ 1.910,20')).toBeInTheDocument();
  });

  it('mostra fechamento e vencimento em dd/MM', async () => {
    renderizar(<Cartoes />);
    expect(await screen.findByText(/Fecha em 28\/08 e vence em 08\/09/)).toBeInTheDocument();
  });

  it('conta assinaturas vinculadas e parcelas em andamento', async () => {
    renderizar(<Cartoes />);
    expect(await screen.findByText(/4 assinaturas debitam neste cartão/)).toBeInTheDocument();
    expect(screen.getByText(/1 compra parcelada em andamento/)).toBeInTheDocument();
  });

  it('troca a fatura ao selecionar outro cartão', async () => {
    renderizar(<Cartoes />);
    await screen.findByRole('region', { name: 'Fatura de Nubank Ultravioleta' });
    await userEvent.click(screen.getByRole('button', { name: /Itaú Click/ }));
    const fatura = await screen.findByRole('region', { name: 'Fatura de Itaú Click' });
    expect(within(fatura).getByText('R$ 702,80')).toBeInTheDocument();
  });

  it('mostra "Nenhum lançamento" para fatura vazia', async () => {
    renderizar(<Cartoes />);
    await userEvent.click(await screen.findByRole('button', { name: /Itaú Click/ }));
    expect(await screen.findByText(/Nenhum lançamento neste cartão no mês/)).toBeInTheDocument();
  });
});

// ──────────────────────────────────────────────────────────── Investimentos

describe('Investimentos', () => {
  it('projeta o valor do protótipo no cenário padrão de 10 anos', async () => {
    renderizar(<Investimentos />);
    // portfolioProjection(seed, 10) = 772.500,28 → R$ 772.500 com 0 decimais.
    const simulador = await screen.findByRole('group', { name: 'Simulador de cenários' });
    expect(within(simulador).getByText('R$ 772.500')).toBeInTheDocument();
  });

  it('recalcula localmente ao mover o prazo, sem nova chamada à API', async () => {
    renderizar(<Investimentos />);
    await screen.findByRole('group', { name: 'Simulador de cenários' });

    const chamadasAntes = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length;
    // fireEvent.change e a forma canonica de mover um range: o jsdom nao
    // implementa o comportamento de seta desse controle.
    const prazo = screen.getByRole('slider', { name: /Prazo/ });
    fireEvent.change(prazo, { target: { value: '11' } });

    // O rotulo do slider e um no de texto unico, ao contrario da frase do card.
    await waitFor(() => expect(screen.getByText('11 anos')).toBeInTheDocument());
    expect(prazo).toHaveValue('11');
    // Nenhuma chamada nova: o recalculo aconteceu inteiro no navegador.
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(chamadasAntes);
  });

  it('mostra os 5 marcos', async () => {
    renderizar(<Investimentos />);
    const marcos = await screen.findByRole('group', { name: 'Provisão futura por marco' });
    for (const rotulo of ['1 ano', '3 anos', '5 anos', '10 anos', '20 anos']) {
      expect(within(marcos).getByText(rotulo)).toBeInTheDocument();
    }
  });

  it('marca os ativos acima e abaixo da meta', async () => {
    renderizar(<Investimentos />);
    await screen.findByText('Tesouro IPCA+ 2035');
    // Bitcoin: 15% a.a. contra meta de 12% → acima.
    expect(screen.getByText(/acima de 12,0%/)).toBeInTheDocument();
    // Ações BR: 9,8% contra meta de 11% → abaixo.
    expect(screen.getByText(/abaixo de 11,0%/)).toBeInTheDocument();
  });

  it('decompõe o total em juros e aporte', async () => {
    renderizar(<Investimentos />);
    expect(await screen.findByText(/vêm de juros e/)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────── Metas e orçamentos

describe('Metas e orçamentos', () => {
  it('mostra o progresso e quanto guardar por mês', async () => {
    renderizar(<Metas />);
    expect(await screen.findByText('Reserva de emergência')).toBeInTheDocument();
    expect(screen.getByText('61%')).toBeInTheDocument();
    expect(screen.getByText(/Guardar R\$ 967 por mês para chegar em 12 meses/)).toBeInTheDocument();
  });

  it('avisa quantas categorias estouraram', async () => {
    renderizar(<Metas />);
    expect(await screen.findByText(/2 categorias acima do limite/)).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────── Relatórios

describe('Relatórios', () => {
  it('mostra os 4 KPIs de análise', async () => {
    renderizar(<Relatorios />);
    expect(await screen.findByText('R$ 46')).toBeInTheDocument(); // taxa de poupança 45,94%
    expect(screen.getByText('R$ 6.118')).toBeInTheDocument();
  });

  it('gera insights a partir do dado, não de texto fixo', async () => {
    renderizar(<Relatorios />);
    expect(
      await screen.findByText(/Moradia foi a maior saída do mês, com R\$ 4\.769,90/),
    ).toBeInTheDocument();
    expect(screen.getByText(/A reserva cobre 2,4 meses de despesa/)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────── Contas

describe('Contas', () => {
  it('lista as contas com saldo e dono', async () => {
    renderizar(<Contas />);
    expect(await screen.findByText('Nubank')).toBeInTheDocument();
    expect(screen.getByText('R$ 6.420,80')).toBeInTheDocument();
    expect(screen.getByText(/Conta conjunta · Ana e Bruno/)).toBeInTheDocument();
  });

  it('mostra "nunca importado" quando não há extrato', async () => {
    renderizar(<Contas />);
    expect(await screen.findAllByText(/nunca importado/)).toHaveLength(3);
  });

  it('oferece o tile de importação', async () => {
    renderizar(<Contas />);
    expect(
      await screen.findByRole('button', { name: 'Importar extrato CSV ou OFX' }),
    ).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────── modo privacidade

describe('modo privacidade nas telas', () => {
  it('mascara todos os valores da visão geral', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    render(
      <QueryClientProvider client={qc}>
        <PrivacyProvider ativo>
          <CompetenciaProvider>
            <MemoryRouter>
              <Dashboard />
            </MemoryRouter>
          </CompetenciaProvider>
        </PrivacyProvider>
      </QueryClientProvider>,
    );

    await waitFor(() => expect(screen.getAllByText(/••••/).length).toBeGreaterThan(0));
    expect(screen.queryByText('R$ 21.881,25')).not.toBeInTheDocument();
    expect(screen.queryByText('R$ 14.400,00')).not.toBeInTheDocument();
  });
});
