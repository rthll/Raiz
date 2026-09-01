/**
 * Regras financeiras do Raiz — TS puro, sem dependências.
 * Compartilhado entre a API (fonte da verdade) e o frontend (sliders do simulador,
 * que precisam recalcular localmente sem round-trip).
 *
 * As fórmulas vêm da classe `Component` do protótipo e estão documentadas no handoff.
 */

// ─────────────────────────────────────────────────────────── assinaturas

export type SubscriptionPeriod = 'MENSAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL';
export type SubscriptionStatus = 'ATIVA' | 'PAUSADA' | 'TESTE';

/** Quantos meses cada cobrança cobre. */
export const PERIOD_MONTHS: Record<SubscriptionPeriod, number> = {
  MENSAL: 1,
  TRIMESTRAL: 3,
  SEMESTRAL: 6,
  ANUAL: 12,
};

export interface SubscriptionLike {
  valor: number;
  periodo: SubscriptionPeriod;
  status: SubscriptionStatus;
}

/** Custo equivalente por mês: `valor / meses do período`. */
export function monthlyCost(subscription: Pick<SubscriptionLike, 'valor' | 'periodo'>): number {
  const divisor = PERIOD_MONTHS[subscription.periodo] ?? 1;
  return subscription.valor / divisor;
}

/** Assinaturas pausadas não entram em nenhum total. */
export function activeSubscriptions<T extends { status: SubscriptionStatus }>(
  list: readonly T[],
): T[] {
  return list.filter((s) => s.status !== 'PAUSADA');
}

export interface SubscriptionsSummary {
  custoMensal: number;
  custoAnual: number;
  ativas: number;
  pausadas: number;
  /** Percentual da renda do mês, em pontos (ex.: 2.6 = 2,6%). 0 quando não há renda. */
  pctRenda: number;
}

export function subscriptionsSummary(
  list: readonly SubscriptionLike[],
  monthlyIncome: number,
): SubscriptionsSummary {
  const ativas = activeSubscriptions(list);
  const custoMensal = ativas.reduce((acc, s) => acc + monthlyCost(s), 0);
  return {
    custoMensal,
    custoAnual: custoMensal * 12,
    ativas: ativas.length,
    pausadas: list.length - ativas.length,
    pctRenda: monthlyIncome > 0 ? (custoMensal / monthlyIncome) * 100 : 0,
  };
}

// ─────────────────────────────────────────────────────────── juros compostos

/**
 * Taxa mensal equivalente a uma taxa anual efetiva (decimal): `(1 + i)^(1/12) - 1`.
 * O piso de 0.0001 replica o guarda do protótipo — evita divisão por zero em `futureValue`.
 */
export function monthlyRate(annualDecimal: number): number {
  return Math.pow(1 + Math.max(0.0001, annualDecimal), 1 / 12) - 1;
}

/**
 * Valor futuro de um capital com aportes mensais no fim de cada período:
 * `pv * (1+r)^n + pmt * (((1+r)^n - 1) / r)`.
 *
 * @param presentValue capital atual
 * @param annualDecimal taxa anual efetiva em decimal (0.112 = 11,2% a.a.)
 * @param monthlyDeposit aporte mensal
 * @param months número de meses
 */
export function futureValue(
  presentValue: number,
  annualDecimal: number,
  monthlyDeposit: number,
  months: number,
): number {
  const r = monthlyRate(annualDecimal);
  const growth = Math.pow(1 + r, months);
  return presentValue * growth + monthlyDeposit * ((growth - 1) / r);
}

// ─────────────────────────────────────────────────────────── carteira

export interface AssetLike {
  valor: number;
  /** Taxa anual em pontos percentuais (11.2 = 11,2% a.a.). */
  taxa: number;
  aporteMensal: number;
}

export interface ProjectionInput {
  /** Ajuste na taxa, em pontos percentuais (−3 a +4 no simulador). */
  ajusteTaxa?: number;
  /** Aporte extra mensal, rateado entre os ativos pelo peso de cada um. */
  aporteExtra?: number;
}

export function totalInvested(assets: readonly AssetLike[]): number {
  return assets.reduce((acc, a) => acc + a.valor, 0);
}

export function baseMonthlyDeposit(assets: readonly AssetLike[]): number {
  return assets.reduce((acc, a) => acc + a.aporteMensal, 0);
}

/** Taxa média ponderada pelo valor de cada ativo, em pontos percentuais. */
export function weightedAverageRate(assets: readonly AssetLike[]): number {
  const total = totalInvested(assets);
  if (total <= 0) return 0;
  return assets.reduce((acc, a) => acc + a.taxa * a.valor, 0) / total;
}

/** Projeção de um ativo isolado, já com o rateio do aporte extra aplicado. */
export function projectAsset(
  asset: AssetLike,
  months: number,
  portfolioTotal: number,
  { ajusteTaxa = 0, aporteExtra = 0 }: ProjectionInput = {},
): number {
  const share = portfolioTotal > 0 ? asset.valor / portfolioTotal : 0;
  const deposit = asset.aporteMensal + aporteExtra * share;
  return futureValue(asset.valor, (asset.taxa + ajusteTaxa) / 100, deposit, months);
}

/** Soma das projeções de todos os ativos. */
export function projectPortfolio(
  assets: readonly AssetLike[],
  months: number,
  input: ProjectionInput = {},
): number {
  const total = totalInvested(assets);
  return assets.reduce((acc, a) => acc + projectAsset(a, months, total, input), 0);
}

export interface PortfolioProjection {
  anos: number;
  meses: number;
  /** Patrimônio projetado ao fim do prazo. */
  total: number;
  /** Quanto do total saiu do bolso: valor atual + aportes ao longo do prazo. */
  totalAportado: number;
  /** `total - totalAportado`. */
  juros: number;
  taxaMediaPonderada: number;
  /** Taxa média já com o ajuste do simulador. */
  taxaSimulada: number;
  aporteMensalTotal: number;
  marcos: Array<{ anos: number; total: number }>;
  porAtivo: Array<{ index: number; total: number }>;
}

export const MILESTONE_YEARS = [1, 3, 5, 10, 20] as const;

/** Resultado completo do simulador de cenários da tela de investimentos. */
export function portfolioProjection(
  assets: readonly AssetLike[],
  anos: number,
  input: ProjectionInput = {},
): PortfolioProjection {
  const { ajusteTaxa = 0, aporteExtra = 0 } = input;
  const meses = anos * 12;
  const investido = totalInvested(assets);
  const aporteBase = baseMonthlyDeposit(assets);
  const total = projectPortfolio(assets, meses, input);
  const totalAportado = investido + (aporteBase + aporteExtra) * meses;
  const taxaMedia = weightedAverageRate(assets);

  return {
    anos,
    meses,
    total,
    totalAportado,
    juros: total - totalAportado,
    taxaMediaPonderada: taxaMedia,
    taxaSimulada: taxaMedia + ajusteTaxa,
    aporteMensalTotal: aporteBase + aporteExtra,
    marcos: MILESTONE_YEARS.map((y) => ({
      anos: y,
      total: projectPortfolio(assets, y * 12, input),
    })),
    porAtivo: assets.map((a, index) => ({
      index,
      total: projectAsset(a, meses, investido, input),
    })),
  };
}

// ─────────────────────────────────────────────────────── orçamentos, metas, relatórios

export interface BudgetUsage {
  gasto: number;
  limite: number;
  /** Percentual de uso; 0 quando não há limite definido. */
  pct: number;
  /** `true` acima de 100% — muda a cor da barra para `#8c491a`. */
  estourou: boolean;
  temLimite: boolean;
}

export function budgetUsage(gasto: number, limite: number | null | undefined): BudgetUsage {
  const temLimite = !!limite && limite > 0;
  const pct = temLimite ? (gasto / (limite as number)) * 100 : 0;
  return { gasto, limite: limite ?? 0, pct, estourou: pct > 100, temLimite };
}

/** Quanto guardar por mês para bater a meta: `(alvo - atual) / prazoMeses`. */
export function goalMonthlySuggestion(alvo: number, atual: number, prazoMeses: number): number {
  const falta = Math.max(0, alvo - atual);
  return falta / Math.max(1, prazoMeses);
}

export function goalProgress(alvo: number, atual: number): number {
  if (alvo <= 0) return 0;
  return (atual / alvo) * 100;
}

/** Taxa de poupança do mês, em pontos percentuais. */
export function savingsRate(entradas: number, saidas: number): number {
  if (entradas <= 0) return 0;
  return ((entradas - saidas) / entradas) * 100;
}

/** Quantos meses de despesa a reserva cobre. */
export function monthsOfReserve(reserva: number, saidasDoMes: number): number {
  if (saidasDoMes <= 0) return 0;
  return reserva / saidasDoMes;
}

/** Divisão do gasto do casal: quanto quem gastou menos transfere para acertar. */
export function coupleSettlement(gastoA: number, gastoB: number): number {
  return Math.abs(gastoA - gastoB) / 2;
}
