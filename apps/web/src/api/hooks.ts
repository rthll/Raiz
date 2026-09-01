import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { del, get, post, put } from './client.js';
import type {
  Assinatura,
  Ativo,
  Cartao,
  Cashflow,
  Categoria,
  Conta,
  Dashboard,
  Fatura,
  ListaLancamentos,
  MetaComProgresso,
  Orcamentos,
  Projecao,
  Regra,
  Relatorios,
  ResumoAssinaturas,
} from './types.js';

/**
 * Hooks de dados.
 *
 * As chaves de query começam sempre pelo nome do recurso, para que
 * `invalidateQueries({ queryKey: ['lancamentos'] })` alcance todas as variações
 * de filtro de uma vez.
 */

export const chaves = {
  dashboard: (mes: string) => ['dashboard', mes] as const,
  lancamentos: (filtro: FiltroLancamentos) => ['lancamentos', filtro] as const,
  categorias: () => ['categorias'] as const,
  contas: () => ['contas'] as const,
  cartoes: () => ['cartoes'] as const,
  fatura: (cardId: string, mes: string) => ['fatura', cardId, mes] as const,
  assinaturas: () => ['assinaturas'] as const,
  resumoAssinaturas: (mes: string) => ['assinaturas', 'resumo', mes] as const,
  ativos: () => ['ativos'] as const,
  projecao: (p: ParametrosProjecao) => ['projecao', p] as const,
  metas: () => ['metas'] as const,
  orcamentos: (mes: string) => ['orcamentos', mes] as const,
  relatorios: (mes: string) => ['relatorios', mes] as const,
  cashflow: (ate: string, meses: number) => ['cashflow', ate, meses] as const,
  regras: () => ['regras'] as const,
};

export interface FiltroLancamentos {
  mes: string;
  tipo?: 'todos' | 'ENTRADA' | 'SAIDA';
  categoriaId?: string;
  cardId?: string;
  accountId?: string;
  q?: string;
}

export interface ParametrosProjecao {
  anos: number;
  ajusteTaxa: number;
  aporteExtra: number;
}

function querystring(filtro: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [chave, valor] of Object.entries(filtro)) {
    if (valor !== undefined && valor !== '' && valor !== 'todos') params.set(chave, String(valor));
  }
  const texto = params.toString();
  return texto ? `?${texto}` : '';
}

// ─────────────────────────────────────────────────────────────── leituras

export const useDashboard = (mes: string) =>
  useQuery({ queryKey: chaves.dashboard(mes), queryFn: () => get<Dashboard>(`/dashboard?mes=${mes}`) });

export const useLancamentos = (filtro: FiltroLancamentos) =>
  useQuery({
    queryKey: chaves.lancamentos(filtro),
    queryFn: () => get<ListaLancamentos>(`/transactions${querystring({ ...filtro })}`),
    // Mantém a lista anterior visível enquanto o filtro novo carrega, em vez de
    // piscar um vazio a cada tecla digitada na busca.
    placeholderData: (anterior) => anterior,
  });

export const useCategorias = () =>
  useQuery({ queryKey: chaves.categorias(), queryFn: () => get<Categoria[]>('/categories') });

export const useContas = () =>
  useQuery({ queryKey: chaves.contas(), queryFn: () => get<Conta[]>('/accounts') });

export const useCartoes = () =>
  useQuery({ queryKey: chaves.cartoes(), queryFn: () => get<Cartao[]>('/cards') });

export const useFatura = (cardId: string | undefined, mes: string) =>
  useQuery({
    queryKey: chaves.fatura(cardId ?? '', mes),
    queryFn: () => get<Fatura>(`/cards/${cardId}/invoice?mes=${mes}`),
    enabled: !!cardId,
  });

export const useAssinaturas = () =>
  useQuery({ queryKey: chaves.assinaturas(), queryFn: () => get<Assinatura[]>('/subscriptions') });

export const useResumoAssinaturas = (mes: string) =>
  useQuery({
    queryKey: chaves.resumoAssinaturas(mes),
    queryFn: () => get<ResumoAssinaturas>(`/subscriptions/summary?mes=${mes}`),
  });

export const useAtivos = () =>
  useQuery({ queryKey: chaves.ativos(), queryFn: () => get<Ativo[]>('/assets') });

export const useMetas = () =>
  useQuery({ queryKey: chaves.metas(), queryFn: () => get<MetaComProgresso[]>('/goals/progress') });

export const useOrcamentos = (mes: string) =>
  useQuery({ queryKey: chaves.orcamentos(mes), queryFn: () => get<Orcamentos>(`/budgets?mes=${mes}`) });

export const useRelatorios = (mes: string) =>
  useQuery({ queryKey: chaves.relatorios(mes), queryFn: () => get<Relatorios>(`/reports?mes=${mes}`) });

export const useCashflow = (ate: string, meses = 8) =>
  useQuery({
    queryKey: chaves.cashflow(ate, meses),
    queryFn: () => get<Cashflow>(`/cashflow?ate=${ate}&meses=${meses}`),
  });

export const useRegras = () =>
  useQuery({ queryKey: chaves.regras(), queryFn: () => get<Regra[]>('/rules') });

/**
 * Projeção de investimentos.
 *
 * O cálculo também roda local, em `@raiz/core`, enquanto o usuário arrasta os
 * sliders — este hook confirma contra o servidor. `placeholderData` evita a tela
 * piscar entre uma projeção e outra.
 */
export const useProjecao = (p: ParametrosProjecao) =>
  useQuery({
    queryKey: chaves.projecao(p),
    queryFn: () => post<Projecao>('/investments/projection', p),
    placeholderData: (anterior) => anterior,
  });

// ─────────────────────────────────────────────────────────────── escritas

/**
 * Qualquer escrita invalida os agregados: um lançamento novo muda o dashboard,
 * os orçamentos, os relatórios e a fatura do cartão ao mesmo tempo.
 */
function invalidarTudo(qc: QueryClient) {
  for (const chave of [
    'dashboard',
    'lancamentos',
    'orcamentos',
    'relatorios',
    'cashflow',
    'fatura',
    'assinaturas',
    'metas',
  ]) {
    void qc.invalidateQueries({ queryKey: [chave] });
  }
}

type Recurso = 'transactions' | 'categories' | 'accounts' | 'cards' | 'subscriptions' | 'assets' | 'goals' | 'rules';

const chaveDoRecurso: Record<Recurso, readonly string[]> = {
  transactions: ['lancamentos'],
  categories: ['categorias'],
  accounts: ['contas'],
  cards: ['cartoes'],
  subscriptions: ['assinaturas'],
  assets: ['ativos'],
  goals: ['metas'],
  rules: ['regras'],
};

/** Cria ou atualiza — o `id` decide qual dos dois. */
export function useSalvar<T>(recurso: Recurso) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dados }: { id?: string; dados: unknown }) =>
      id ? put<T>(`/${recurso}/${id}`, dados) : post<T>(`/${recurso}`, dados),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: chaveDoRecurso[recurso] });
      invalidarTudo(qc);
    },
  });
}

export function useExcluir(recurso: Recurso) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => del(`/${recurso}/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: chaveDoRecurso[recurso] });
      invalidarTudo(qc);
    },
  });
}

/** Pausa ou reativa uma assinatura. */
export function useAlternarAssinatura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => post<Assinatura>(`/subscriptions/${id}/toggle`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['assinaturas'] });
      invalidarTudo(qc);
    },
  });
}

/** Alterna o estado de pagamento da fatura. */
export function usePagarFatura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cardId, mes }: { cardId: string; mes: string }) =>
      post<{ competencia: string; paga: boolean; total: number }>(
        `/cards/${cardId}/invoice/${mes}/pay`,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['fatura'] });
    },
  });
}

export { useQueryClient };
