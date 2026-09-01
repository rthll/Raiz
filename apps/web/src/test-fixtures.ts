/**
 * Respostas de API para os testes, com os dados do seed do protótipo.
 *
 * Vive fora dos arquivos de teste para que a auditoria de acessibilidade e os
 * testes de tela usem exatamente o mesmo dado — se divergissem, um poderia
 * passar com um caso que o outro não cobre.
 */

export const CATEGORIAS = [
  { id: 'k1', nome: 'Moradia', tipo: 'SAIDA', cor: '#b2622d', orcamentoMensal: 2600, ordem: 0 },
  { id: 'k2', nome: 'Alimentação', tipo: 'SAIDA', cor: '#d67f48', orcamentoMensal: 1500, ordem: 1 },
  { id: 'k4', nome: 'Saúde', tipo: 'SAIDA', cor: '#8fa073', orcamentoMensal: 700, ordem: 2 },
  { id: 'k8', nome: 'Salário', tipo: 'ENTRADA', cor: '#56633f', orcamentoMensal: null, ordem: 3 },
];

export const CONTAS = [
  { id: 'b1', nome: 'Nubank', tipo: 'CORRENTE', dono: 'Ana', saldo: 6420.8, ultimaSync: null },
  {
    id: 'b2',
    nome: 'Itaú',
    tipo: 'CONJUNTA',
    dono: 'Ana e Bruno',
    saldo: 12310.45,
    ultimaSync: '2026-08-28T00:00:00.000Z',
  },
  { id: 'b3', nome: 'Reserva', tipo: 'POUPANCA', dono: 'Conjunta', saldo: 3150, ultimaSync: null },
];

export const CARTOES = [
  {
    id: 'c1',
    nome: 'Nubank Ultravioleta',
    bandeira: 'MASTERCARD',
    final: '4821',
    limite: 12000,
    diaFechamento: 28,
    diaVencimento: 8,
    temaEscuro: true,
    ordem: 0,
  },
  {
    id: 'c2',
    nome: 'Itaú Click',
    bandeira: 'VISA',
    final: '9033',
    limite: 8000,
    diaFechamento: 2,
    diaVencimento: 12,
    temaEscuro: false,
    ordem: 1,
  },
];

export const LANCAMENTOS = {
  itens: [
    {
      id: 't1',
      data: '2026-08-01',
      descricao: 'Salário Ana',
      valor: 7400,
      tipo: 'ENTRADA',
      categoriaId: 'k8',
      accountId: 'b2',
      cardId: null,
      responsavel: 'ANA',
      parcelaAtual: null,
      parcelaTotal: null,
      recurrenceId: 'r1',
      recorrente: true,
    },
    {
      id: 't3',
      data: '2026-08-05',
      descricao: 'Aluguel',
      valor: 2200,
      tipo: 'SAIDA',
      categoriaId: 'k1',
      accountId: 'b2',
      cardId: null,
      responsavel: 'CONJUNTA',
      parcelaAtual: null,
      parcelaTotal: null,
      recurrenceId: null,
      recorrente: false,
    },
    {
      id: 't11',
      data: '2026-08-17',
      descricao: 'Notebook',
      valor: 389.9,
      tipo: 'SAIDA',
      categoriaId: 'k1',
      accountId: null,
      cardId: 'c1',
      responsavel: 'BRUNO',
      parcelaAtual: 3,
      parcelaTotal: 10,
      recurrenceId: null,
      recorrente: false,
    },
  ],
  resumo: { exibidos: 3, total: 17, entradas: 7400, saidas: 2589.9, saldo: 4810.1 },
};

export const DASHBOARD = {
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
    {
      tipo: 'assinatura',
      nome: 'Academia',
      detalhe: 'mensal · Itaú Click',
      valor: 129,
      data: '2026-09-02',
      destaque: false,
    },
    {
      tipo: 'fatura',
      nome: 'Fatura Nubank Ultravioleta',
      detalhe: 'vence dia 8',
      valor: 1910.2,
      data: '2026-08-08',
      destaque: true,
    },
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

export const FATURA = {
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

export const ATIVOS = [
  { id: 'a1', nome: 'Tesouro IPCA+ 2035', classe: 'RENDA_FIXA', valor: 42000, taxaAnual: 11.2, aporteMensal: 400, metaTaxa: 10, ordem: 0 },
  { id: 'a3', nome: 'FII de logística', classe: 'FUNDOS_IMOBILIARIOS', valor: 26300, taxaAnual: 8.6, aporteMensal: 250, metaTaxa: 9.5, ordem: 1 },
  { id: 'a4', nome: 'ETF S&P 500', classe: 'ACOES_EXTERIOR', valor: 31700, taxaAnual: 12.5, aporteMensal: 500, metaTaxa: 11, ordem: 2 },
  { id: 'a5', nome: 'Carteira de ações BR', classe: 'ACOES_BRASIL', valor: 14900, taxaAnual: 9.8, aporteMensal: 150, metaTaxa: 11, ordem: 3 },
  { id: 'a6', nome: 'Bitcoin', classe: 'CRIPTO', valor: 9400, taxaAnual: 15, aporteMensal: 100, metaTaxa: 12, ordem: 4 },
];

export const METAS = [
  { id: 'g1', nome: 'Reserva de emergência', alvo: 30000, atual: 18400, prazoMeses: 12, ordem: 0, progresso: 61.333, guardarPorMes: 966.67, atingida: false },
  { id: 'g2', nome: 'Viagem ao Japão', alvo: 24000, atual: 7250, prazoMeses: 18, ordem: 1, progresso: 30.2, guardarPorMes: 930.56, atingida: false },
];

export const ORCAMENTOS = {
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

export const RELATORIOS = {
  competencia: '2026-08',
  kpis: {
    taxaPoupanca: 45.94,
    custoFixo: 6117.9,
    custoVariavel: 1665.8,
    mesesDeReserva: 2.36,
    reserva: 18400,
  },
  maioresCategorias: [
    { categoria: CATEGORIAS[0], gasto: 4769.9 },
    { categoria: CATEGORIAS[1], gasto: 947.6 },
  ],
  assinaturasAtivas: 7,
  entradas: 14400,
  saidas: 7783.7,
};

export const ASSINATURAS = [
  { id: 's1', nome: 'Streaming de vídeo', valor: 55.9, periodo: 'MENSAL', proximoDebito: '2026-09-05', cardId: 'c1', categoriaId: 'k2', status: 'ATIVA', observacao: 'Plano família', precoAnterior: null },
  { id: 's5', nome: 'Suíte de design', valor: 1290, periodo: 'ANUAL', proximoDebito: '2026-11-18', cardId: 'c1', categoriaId: 'k2', status: 'ATIVA', observacao: null, precoAnterior: null },
  { id: 's7', nome: 'Jornal digital', valor: 119.7, periodo: 'TRIMESTRAL', proximoDebito: '2026-09-30', cardId: 'c2', categoriaId: 'k2', status: 'PAUSADA', observacao: null, precoAnterior: null },
];

export const RESUMO_ASSINATURAS = {
  custoMensal: 380.1,
  custoAnual: 4561.2,
  ativas: 7,
  pausadas: 1,
  pctRenda: 2.64,
  maisCara: { nome: 'Academia', mensal: 129 },
};

export const CASHFLOW = {
  ate: '2026-08',
  meses: [
    { mes: '2026-07', entradas: 14200, saidas: 9310 },
    { mes: '2026-08', entradas: 14400, saidas: 7783.7 },
  ],
};

export const REGRAS = [{ id: 'x1', termo: 'SUPERMERC', categoriaId: 'k2', acertos: 14, ordem: 0 }];

export const IMPORTACOES = [
  {
    id: 'i1',
    arquivo: 'nubank-2026-08.ofx',
    accountId: 'b1',
    periodoInicio: '2026-08-01',
    periodoFim: '2026-08-28',
    quantidade: 42,
    classificados: 38,
    criadoEm: '2026-08-29T10:00:00.000Z',
  },
];

/** Rota → resposta. Uma rota fora daqui devolve `[]`. */
export const RESPOSTAS: Record<string, unknown> = {
  '/api/dashboard': DASHBOARD,
  '/api/transactions': LANCAMENTOS,
  '/api/categories': CATEGORIAS,
  '/api/accounts': CONTAS,
  '/api/cards': CARTOES,
  '/api/cards/c1/invoice': FATURA,
  '/api/cards/c2/invoice': { ...FATURA, cartao: CARTOES[1], total: 702.8, itens: [] },
  '/api/subscriptions': ASSINATURAS,
  '/api/subscriptions/summary': RESUMO_ASSINATURAS,
  '/api/assets': ATIVOS,
  '/api/goals/progress': METAS,
  '/api/budgets': ORCAMENTOS,
  '/api/reports': RELATORIOS,
  '/api/cashflow': CASHFLOW,
  '/api/rules': REGRAS,
  '/api/imports': IMPORTACOES,
};
