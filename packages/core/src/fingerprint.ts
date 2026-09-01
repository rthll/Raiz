/**
 * Dedupe de importação de extrato.
 *
 * O handoff define o fingerprint como `data + valor + descrição normalizada`.
 * Normalizar é o ponto delicado: o mesmo lançamento vem com acentuação, caixa e
 * espaçamento diferentes conforme o banco e o formato (CSV vs OFX).
 */

/** Remove acentos, caixa, pontuação e espaços repetidos. */
export function normalizeDescription(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export interface FingerprintInput {
  /** Data do lançamento no formato ISO `YYYY-MM-DD`. */
  data: string;
  /** Valor absoluto em reais. */
  valor: number;
  descricao: string;
  /** Conta de destino — o mesmo lançamento em contas distintas não é duplicata. */
  accountId: string;
}

/**
 * Chave estável de deduplicação. Guardada como `unique` em `Transaction.fingerprint`,
 * então dois arquivos com o mesmo lançamento não geram duas linhas.
 */
export function transactionFingerprint({
  data,
  valor,
  descricao,
  accountId,
}: FingerprintInput): string {
  const cents = Math.round(Math.abs(valor) * 100);
  return [accountId, data, cents, normalizeDescription(descricao)].join('|');
}

/**
 * Aplica as regras de classificação automática: o primeiro termo contido na
 * descrição normalizada define a categoria. Devolve `null` quando nada bate.
 */
export function matchRule<T extends { termo: string }>(
  descricao: string,
  rules: readonly T[],
): T | null {
  const alvo = normalizeDescription(descricao);
  for (const rule of rules) {
    // Um termo pode listar variantes separadas por "/" — ex.: "UBER / 99".
    const variantes = rule.termo
      .split('/')
      .map((t) => normalizeDescription(t))
      .filter(Boolean);
    if (variantes.some((v) => alvo.includes(v))) return rule;
  }
  return null;
}
