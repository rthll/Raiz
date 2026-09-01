import { naoEncontrado } from './errors.js';

/**
 * Intervalo de uma competência `YYYY-MM`, em UTC.
 * Devolve `[primeiro dia, primeiro dia do mês seguinte)` — meio aberto, para o
 * filtro `gte/lt` pegar o mês inteiro sem depender do número de dias.
 */
export function intervaloDoMes(competencia: string): { inicio: Date; fim: Date } {
  const [ano, mes] = competencia.split('-').map(Number);
  if (!ano || !mes) throw new Error(`Competência inválida: ${competencia}`);
  return {
    inicio: new Date(Date.UTC(ano, mes - 1, 1)),
    fim: new Date(Date.UTC(ano, mes, 1)),
  };
}

/** `Date` → `YYYY-MM`. */
export function competenciaDe(data: Date): string {
  return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Confirma que um `updateMany`/`deleteMany` com `householdId` no `where` mexeu em
 * alguma linha. Zero significa que o registro não existe **ou** é de outro
 * household — e a resposta é a mesma nos dois casos, de propósito: um 403
 * confirmaria que o id existe em algum lugar.
 */
export function exigirAfetado(count: number, oQue: string): void {
  if (count === 0) throw naoEncontrado(oQue);
}

/** Como acima, para leituras: `findFirst` escopado que não pode voltar nulo. */
export function exigirEncontrado<T>(registro: T | null, oQue: string): T {
  if (registro == null) throw naoEncontrado(oQue);
  return registro;
}
