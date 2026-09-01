/**
 * Os dados do protótipo, transcritos.
 *
 * Vive separado de `seed.ts` (que só escreve no banco) porque é dado puro e pode
 * ser conferido por teste sem subir Postgres: `seed-data.test.ts` recalcula os
 * agregados daqui e compara com os números que aparecem nos screenshots.
 *
 * Fonte: design/Raiz Gestao Financeira.dc.html, bloco `state`.
 * Competência de referência: agosto de 2026.
 */

export const COMPETENCIA = '2026-08';
export const ANO = 2026;

/** `'05/08'` → `2026-08-05`, no fuso UTC para não escorregar de dia. */
export function dataBR(ddmm: string, ano = ANO): Date {
  const [dia, mes] = ddmm.split('/').map(Number);
  if (!dia || !mes) throw new Error(`Data inválida: ${ddmm}`);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

// ─────────────────────────────────────────────────────────────── household

export const HOUSEHOLD = { nome: 'Casa da Ana e do Bruno' };

export const USERS = [
  { email: 'ana@raiz.app', nome: 'Ana', senha: 'raiz1234' },
  { email: 'bruno@raiz.app', nome: 'Bruno', senha: 'raiz1234' },
] as const;

/** As três flags que no protótipo eram props tweakáveis. */
export const PREFERENCIAS_PADRAO = {
  modoPrivacidade: false,
  modoCasal: true,
  alertasVencimento: true,
};

// ───────────────────────────────────────────────────────────────── contas

export const CONTAS = [
  { ref: 'b1', nome: 'Nubank', tipo: 'CORRENTE', dono: 'Ana', saldo: 6420.8, sync: 'ontem' },
  { ref: 'b2', nome: 'Itaú', tipo: 'CONJUNTA', dono: 'Ana e Bruno', saldo: 12310.45, sync: 'há 3 dias' },
  { ref: 'b3', nome: 'Reserva', tipo: 'POUPANCA', dono: 'Conjunta', saldo: 3150, sync: 'há 1 semana' },
] as const;

// ──────────────────────────────────────────────────────────────── cartões

export const CARTOES = [
  {
    ref: 'c1',
    nome: 'Nubank Ultravioleta',
    bandeira: 'MASTERCARD',
    final: '4821',
    limite: 12000,
    diaFechamento: 28,
    diaVencimento: 8,
    temaEscuro: true,
  },
  {
    ref: 'c2',
    nome: 'Itaú Click',
    bandeira: 'VISA',
    final: '9033',
    limite: 8000,
    diaFechamento: 2,
    diaVencimento: 12,
    temaEscuro: false,
  },
  {
    ref: 'c3',
    nome: 'Inter Gold',
    bandeira: 'MASTERCARD',
    final: '1174',
    limite: 5000,
    diaFechamento: 5,
    diaVencimento: 15,
    temaEscuro: false,
  },
] as const;

// ────────────────────────────────────────────────────────────── categorias

export const CATEGORIAS = [
  { ref: 'k1', nome: 'Moradia', tipo: 'SAIDA', cor: '#b2622d', orcamento: 2600 },
  { ref: 'k2', nome: 'Alimentação', tipo: 'SAIDA', cor: '#d67f48', orcamento: 1500 },
  { ref: 'k3', nome: 'Transporte', tipo: 'SAIDA', cor: '#645c50', orcamento: 650 },
  { ref: 'k4', nome: 'Saúde', tipo: 'SAIDA', cor: '#8fa073', orcamento: 700 },
  { ref: 'k5', nome: 'Lazer', tipo: 'SAIDA', cor: '#aebf92', orcamento: 600 },
  { ref: 'k6', nome: 'Assinaturas', tipo: 'SAIDA', cor: '#f6a06b', orcamento: 450 },
  { ref: 'k7', nome: 'Educação', tipo: 'SAIDA', cor: '#728157', orcamento: 480 },
  // Categoria de entrada: o protótipo guardava orçamento 0, que aqui vira "sem limite".
  { ref: 'k8', nome: 'Salário', tipo: 'ENTRADA', cor: '#56633f', orcamento: null },
] as const;

// ───────────────────────────────────────────────────────────── lançamentos

/**
 * `origem` substitui o campo `conta` de texto do protótipo, que misturava banco e
 * cartão. Aqui a referência já diz qual é qual — é o que decide se o lançamento
 * entra na fatura.
 */
export interface SeedTransacao {
  ref: string;
  data: string;
  descricao: string;
  categoria: string;
  tipo: 'ENTRADA' | 'SAIDA';
  valor: number;
  origem: { conta: string } | { cartao: string };
  recorrencia: 'SEMANAL' | 'MENSAL' | 'ANUAL' | null;
  responsavel: 'ANA' | 'BRUNO' | 'CONJUNTA';
  parcela?: { atual: number; total: number };
}

export const TRANSACOES: SeedTransacao[] = [
  { ref: 't1', data: '01/08', descricao: 'Salário Ana', categoria: 'Salário', tipo: 'ENTRADA', valor: 7400, origem: { conta: 'Itaú' }, recorrencia: 'MENSAL', responsavel: 'ANA' },
  { ref: 't2', data: '05/08', descricao: 'Salário Bruno', categoria: 'Salário', tipo: 'ENTRADA', valor: 5200, origem: { conta: 'Nubank' }, recorrencia: 'MENSAL', responsavel: 'BRUNO' },
  { ref: 't3', data: '05/08', descricao: 'Aluguel', categoria: 'Moradia', tipo: 'SAIDA', valor: 2200, origem: { conta: 'Itaú' }, recorrencia: 'MENSAL', responsavel: 'CONJUNTA' },
  { ref: 't4', data: '06/08', descricao: 'Condomínio', categoria: 'Moradia', tipo: 'SAIDA', valor: 480, origem: { conta: 'Itaú' }, recorrencia: 'MENSAL', responsavel: 'CONJUNTA' },
  { ref: 't5', data: '08/08', descricao: 'Supermercado Vila', categoria: 'Alimentação', tipo: 'SAIDA', valor: 612.4, origem: { cartao: 'Nubank Ultravioleta' }, recorrencia: null, responsavel: 'ANA' },
  { ref: 't6', data: '09/08', descricao: 'Combustível', categoria: 'Transporte', tipo: 'SAIDA', valor: 288.9, origem: { cartao: 'Nubank Ultravioleta' }, recorrencia: null, responsavel: 'BRUNO' },
  { ref: 't7', data: '11/08', descricao: 'Restaurante do bairro', categoria: 'Alimentação', tipo: 'SAIDA', valor: 186.5, origem: { cartao: 'Itaú Click' }, recorrencia: null, responsavel: 'CONJUNTA' },
  { ref: 't8', data: '12/08', descricao: 'Plano de saúde', categoria: 'Saúde', tipo: 'SAIDA', valor: 642, origem: { conta: 'Itaú' }, recorrencia: 'MENSAL', responsavel: 'CONJUNTA' },
  { ref: 't9', data: '14/08', descricao: 'Cinema e jantar', categoria: 'Lazer', tipo: 'SAIDA', valor: 214, origem: { cartao: 'Nubank Ultravioleta' }, recorrencia: null, responsavel: 'ANA' },
  { ref: 't10', data: '15/08', descricao: 'Curso de inglês', categoria: 'Educação', tipo: 'SAIDA', valor: 420, origem: { cartao: 'Itaú Click' }, recorrencia: 'MENSAL', responsavel: 'BRUNO' },
  { ref: 't11', data: '17/08', descricao: 'Notebook (3/10)', categoria: 'Moradia', tipo: 'SAIDA', valor: 389.9, origem: { cartao: 'Nubank Ultravioleta' }, recorrencia: null, responsavel: 'BRUNO', parcela: { atual: 3, total: 10 } },
  { ref: 't12', data: '18/08', descricao: 'Feira orgânica', categoria: 'Alimentação', tipo: 'SAIDA', valor: 148.7, origem: { conta: 'Nubank' }, recorrencia: 'SEMANAL', responsavel: 'ANA' },
  { ref: 't13', data: '20/08', descricao: 'Assinaturas do mês', categoria: 'Assinaturas', tipo: 'SAIDA', valor: 272.6, origem: { cartao: 'Nubank Ultravioleta' }, recorrencia: 'MENSAL', responsavel: 'CONJUNTA' },
  { ref: 't14', data: '22/08', descricao: 'Freela de design', categoria: 'Salário', tipo: 'ENTRADA', valor: 1800, origem: { conta: 'Nubank' }, recorrencia: null, responsavel: 'ANA' },
  { ref: 't15', data: '24/08', descricao: 'Farmácia', categoria: 'Saúde', tipo: 'SAIDA', valor: 96.3, origem: { cartao: 'Itaú Click' }, recorrencia: null, responsavel: 'CONJUNTA' },
  { ref: 't16', data: '26/08', descricao: 'Uber para o trabalho', categoria: 'Transporte', tipo: 'SAIDA', valor: 132.4, origem: { cartao: 'Nubank Ultravioleta' }, recorrencia: null, responsavel: 'ANA' },
  { ref: 't17', data: '28/08', descricao: 'Aporte mensal', categoria: 'Moradia', tipo: 'SAIDA', valor: 1700, origem: { conta: 'Itaú' }, recorrencia: 'MENSAL', responsavel: 'CONJUNTA' },
];

// ────────────────────────────────────────────────────────────── assinaturas

export const ASSINATURAS = [
  { ref: 's1', nome: 'Streaming de vídeo', valor: 55.9, periodo: 'MENSAL', proximo: '05/09', cartao: 'Nubank Ultravioleta', categoria: 'Assinaturas', status: 'ATIVA', observacao: 'Plano família' },
  { ref: 's2', nome: 'Música em família', valor: 34.9, periodo: 'MENSAL', proximo: '09/09', cartao: 'Nubank Ultravioleta', categoria: 'Assinaturas', status: 'ATIVA', observacao: null },
  { ref: 's3', nome: 'Nuvem 2 TB', valor: 27.9, periodo: 'MENSAL', proximo: '12/09', cartao: 'Itaú Click', categoria: 'Assinaturas', status: 'ATIVA', observacao: null },
  { ref: 's4', nome: 'Academia', valor: 129, periodo: 'MENSAL', proximo: '02/09', cartao: 'Itaú Click', categoria: 'Saúde', status: 'ATIVA', observacao: 'Dois acessos' },
  { ref: 's5', nome: 'Suíte de design', valor: 1290, periodo: 'ANUAL', proximo: '18/11', cartao: 'Nubank Ultravioleta', categoria: 'Educação', status: 'ATIVA', observacao: 'Renova por 1.290 em novembro' },
  { ref: 's6', nome: 'Seguro do celular', valor: 24.9, periodo: 'MENSAL', proximo: '20/09', cartao: 'Inter Gold', categoria: 'Assinaturas', status: 'ATIVA', observacao: null },
  { ref: 's7', nome: 'Jornal digital', valor: 119.7, periodo: 'TRIMESTRAL', proximo: '30/09', cartao: 'Inter Gold', categoria: 'Lazer', status: 'PAUSADA', observacao: null },
  // Teste grátis: custa 0 hoje e vira 49,90 no próximo débito — é o que dispara o banner de alerta.
  { ref: 's8', nome: 'App de meditação', valor: 0, periodo: 'MENSAL', proximo: '06/09', cartao: 'Nubank Ultravioleta', categoria: 'Saúde', status: 'TESTE', observacao: 'Vira 49,90 em 06/09', precoAnterior: 49.9 },
] as const;

// ──────────────────────────────────────────────────────────── investimentos

export const ATIVOS = [
  { ref: 'a1', nome: 'Tesouro IPCA+ 2035', classe: 'RENDA_FIXA', valor: 42000, taxaAnual: 11.2, aporteMensal: 400, metaTaxa: 10 },
  { ref: 'a2', nome: 'CDB liquidez diária', classe: 'RENDA_FIXA', valor: 18500, taxaAnual: 10.4, aporteMensal: 300, metaTaxa: 10 },
  { ref: 'a3', nome: 'FII de logística', classe: 'FUNDOS_IMOBILIARIOS', valor: 26300, taxaAnual: 8.6, aporteMensal: 250, metaTaxa: 9.5 },
  { ref: 'a4', nome: 'ETF S&P 500', classe: 'ACOES_EXTERIOR', valor: 31700, taxaAnual: 12.5, aporteMensal: 500, metaTaxa: 11 },
  { ref: 'a5', nome: 'Carteira de ações BR', classe: 'ACOES_BRASIL', valor: 14900, taxaAnual: 9.8, aporteMensal: 150, metaTaxa: 11 },
  { ref: 'a6', nome: 'Bitcoin', classe: 'CRIPTO', valor: 9400, taxaAnual: 15, aporteMensal: 100, metaTaxa: 12 },
] as const;

// ────────────────────────────────────────────────────────────────── metas

export const METAS = [
  { ref: 'g1', nome: 'Reserva de emergência', alvo: 30000, atual: 18400, prazoMeses: 12 },
  { ref: 'g2', nome: 'Viagem ao Japão', alvo: 24000, atual: 7250, prazoMeses: 18 },
  { ref: 'g3', nome: 'Entrada do apartamento', alvo: 90000, atual: 32800, prazoMeses: 36 },
  { ref: 'g4', nome: 'Troca do carro', alvo: 45000, atual: 11900, prazoMeses: 24 },
] as const;

// ─────────────────────────────────────────────────── regras e importações

export const REGRAS = [
  { termo: 'SUPERMERC', categoria: 'Alimentação', acertos: 14 },
  { termo: 'UBER / 99', categoria: 'Transporte', acertos: 9 },
  { termo: 'DROGA', categoria: 'Saúde', acertos: 5 },
  { termo: 'ASSINATURA', categoria: 'Assinaturas', acertos: 8 },
] as const;

export const IMPORTACOES = [
  { arquivo: 'nubank-2026-08.ofx', conta: 'Nubank', inicio: '01/08', fim: '28/08', quantidade: 42, classificados: 38 },
  { arquivo: 'itau-conjunta.csv', conta: 'Itaú', inicio: '01/08', fim: '25/08', quantidade: 27, classificados: 24 },
  { arquivo: 'nubank-2026-07.ofx', conta: 'Nubank', inicio: '01/07', fim: '31/07', quantidade: 45, classificados: 45 },
] as const;

/**
 * Série de fluxo de caixa de março a outubro de 2026, exibida no dashboard e nos
 * relatórios. Os meses de índice > 5 (setembro e outubro) são previstos, não
 * realizados — a UI os desenha com opacidade reduzida.
 */
export const FLUXO_MENSAL = [
  { mes: '2026-03', entradas: 12600, saidas: 8120 },
  { mes: '2026-04', entradas: 12600, saidas: 9040 },
  { mes: '2026-05', entradas: 13100, saidas: 7860 },
  { mes: '2026-06', entradas: 12600, saidas: 8740 },
  { mes: '2026-07', entradas: 14200, saidas: 9310 },
  { mes: '2026-08', entradas: 14400, saidas: 8100 },
  { mes: '2026-09', entradas: 12600, saidas: 8600, previsto: true },
  { mes: '2026-10', entradas: 12600, saidas: 8950, previsto: true },
] as const;
