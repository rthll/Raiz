/** Tipos das respostas da API. Espelham os DTOs de `apps/api/src/http/dto.ts`. */

export type TipoTransacao = 'ENTRADA' | 'SAIDA';
export type Responsavel = 'ANA' | 'BRUNO' | 'CONJUNTA';
export type TipoConta = 'CORRENTE' | 'CONJUNTA' | 'POUPANCA';
export type Bandeira = 'VISA' | 'MASTERCARD' | 'ELO' | 'AMEX';
export type PeriodoAssinatura = 'MENSAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL';
export type StatusAssinatura = 'ATIVA' | 'PAUSADA' | 'TESTE';
export type ClasseAtivo =
  | 'RENDA_FIXA'
  | 'FUNDOS_IMOBILIARIOS'
  | 'ACOES_EXTERIOR'
  | 'ACOES_BRASIL'
  | 'CRIPTO';

export interface Preferencias {
  modoPrivacidade?: boolean;
  modoCasal?: boolean;
  alertasVencimento?: boolean;
}

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  householdId: string;
  preferencias: Preferencias;
}

export interface Conta {
  id: string;
  nome: string;
  tipo: TipoConta;
  dono: string;
  saldo: number;
  ultimaSync: string | null;
}

export interface Cartao {
  id: string;
  nome: string;
  bandeira: Bandeira;
  final: string;
  limite: number;
  diaFechamento: number;
  diaVencimento: number;
  temaEscuro: boolean;
  ordem: number;
}

export interface Categoria {
  id: string;
  nome: string;
  tipo: TipoTransacao;
  cor: string;
  orcamentoMensal: number | null;
  ordem: number;
}

export interface Lancamento {
  id: string;
  data: string;
  descricao: string;
  valor: number;
  tipo: TipoTransacao;
  categoriaId: string;
  accountId: string | null;
  cardId: string | null;
  responsavel: Responsavel;
  parcelaAtual: number | null;
  parcelaTotal: number | null;
  recurrenceId: string | null;
  recorrente: boolean;
}

export interface ListaLancamentos {
  itens: Lancamento[];
  resumo: {
    exibidos: number;
    total: number;
    entradas: number;
    saidas: number;
    saldo: number;
  };
}

export interface Assinatura {
  id: string;
  nome: string;
  valor: number;
  periodo: PeriodoAssinatura;
  proximoDebito: string;
  cardId: string | null;
  categoriaId: string;
  status: StatusAssinatura;
  observacao: string | null;
  precoAnterior: number | null;
}

export interface ResumoAssinaturas {
  custoMensal: number;
  custoAnual: number;
  ativas: number;
  pausadas: number;
  pctRenda: number;
  maisCara: { nome: string; mensal: number } | null;
}

export interface Ativo {
  id: string;
  nome: string;
  classe: ClasseAtivo;
  valor: number;
  taxaAnual: number;
  aporteMensal: number;
  metaTaxa: number;
  ordem: number;
}

export interface Meta {
  id: string;
  nome: string;
  alvo: number;
  atual: number;
  prazoMeses: number;
  ordem: number;
}

export interface MetaComProgresso extends Meta {
  progresso: number;
  guardarPorMes: number;
  atingida: boolean;
}

export interface Regra {
  id: string;
  termo: string;
  categoriaId: string;
  acertos: number;
  ordem: number;
}

export interface UsoOrcamento {
  gasto: number;
  limite: number;
  pct: number;
  estourou: boolean;
  temLimite: boolean;
}

export interface Dashboard {
  competencia: string;
  kpis: {
    saldoContas: number;
    entradas: number;
    saidas: number;
    saldoDoMes: number;
    investido: number;
    patrimonio: number;
    custoAssinaturas: number;
    totalFaturas: number;
  };
  gastoPorCategoria: Array<{
    categoria: Categoria;
    gasto: number;
    quantidade: number;
    orcamento: UsoOrcamento;
  }>;
  vencimentos: Array<{
    tipo: 'assinatura' | 'fatura';
    nome: string;
    detalhe: string;
    valor: number;
    data: string;
    destaque: boolean;
  }>;
  divisaoCasal: {
    porResponsavel: Array<{ responsavel: Responsavel; gasto: number; percentual: number }>;
    acerto: number;
  };
  investimentos: { total: number; taxaMediaPonderada: number; aporteMensal: number };
  alertas: {
    testeGratis: { nome: string; data: string; passaACustar: number | null } | null;
    faturaFechando: { nome: string; dia: number } | null;
  };
}

export interface Fatura {
  cartao: Cartao;
  competencia: string;
  fechamento: string;
  vencimento: string;
  total: number;
  limite: number;
  usoDoLimite: number;
  paga: boolean;
  pagaEm: string | null;
  itens: Lancamento[];
  assinaturasVinculadas: { quantidade: number; custoMensal: number };
  parcelasEmAndamento: number;
}

export interface Projecao {
  anos: number;
  meses: number;
  total: number;
  totalAportado: number;
  juros: number;
  taxaMediaPonderada: number;
  taxaSimulada: number;
  aporteMensalTotal: number;
  marcos: Array<{ anos: number; total: number }>;
  porAtivo: Array<Ativo & { projetado: number; bateMeta: boolean }>;
  alocacao: Array<{ classe: ClasseAtivo; valor: number }>;
}

export interface Orcamentos {
  competencia: string;
  itens: Array<{ categoria: Categoria } & UsoOrcamento>;
  limiteSomado: number;
  gastoSomado: number;
  estourados: number;
}

export interface Relatorios {
  competencia: string;
  kpis: {
    taxaPoupanca: number;
    custoFixo: number;
    custoVariavel: number;
    mesesDeReserva: number;
    reserva: number;
  };
  maioresCategorias: Array<{ categoria: Categoria; gasto: number }>;
  assinaturasAtivas: number;
  entradas: number;
  saidas: number;
}

export interface Cashflow {
  ate: string;
  meses: Array<{ mes: string; entradas: number; saidas: number }>;
}
