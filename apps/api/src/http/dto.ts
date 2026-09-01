import type {
  Account,
  Asset,
  Card,
  Category,
  Goal,
  Import,
  Invoice,
  Prisma,
  Rule,
  Subscription,
  Transaction,
} from '@prisma/client';

/**
 * Prisma devolve dinheiro como `Decimal`, que serializa em JSON como string.
 * O frontend quer número. A conversão acontece só aqui, na borda — dentro da API
 * as somas continuam em Decimal para não acumular erro de ponto flutuante.
 */
const n = (v: Prisma.Decimal | null | undefined): number => (v == null ? 0 : Number(v));
const nOuNulo = (v: Prisma.Decimal | null | undefined): number | null =>
  v == null ? null : Number(v);

/** `Date` → `YYYY-MM-DD`. Datas do domínio não têm hora nem fuso. */
const dia = (d: Date): string => d.toISOString().slice(0, 10);

export const contaDTO = (c: Account) => ({
  id: c.id,
  nome: c.nome,
  tipo: c.tipo,
  dono: c.dono,
  saldo: n(c.saldo),
  ultimaSync: c.ultimaSync ? c.ultimaSync.toISOString() : null,
});

export const cartaoDTO = (c: Card) => ({
  id: c.id,
  nome: c.nome,
  bandeira: c.bandeira,
  final: c.final,
  limite: n(c.limite),
  diaFechamento: c.diaFechamento,
  diaVencimento: c.diaVencimento,
  temaEscuro: c.temaEscuro,
  ordem: c.ordem,
});

export const categoriaDTO = (c: Category) => ({
  id: c.id,
  nome: c.nome,
  tipo: c.tipo,
  cor: c.cor,
  // Null é "sem limite", que a UI mostra diferente de limite zero.
  orcamentoMensal: nOuNulo(c.orcamentoMensal),
  ordem: c.ordem,
});

export const lancamentoDTO = (t: Transaction) => ({
  id: t.id,
  data: dia(t.data),
  descricao: t.descricao,
  valor: n(t.valor),
  tipo: t.tipo,
  categoriaId: t.categoriaId,
  accountId: t.accountId,
  cardId: t.cardId,
  responsavel: t.responsavel,
  parcelaAtual: t.parcelaAtual,
  parcelaTotal: t.parcelaTotal,
  recurrenceId: t.recurrenceId,
  recorrente: t.recurrenceId != null,
});

export const assinaturaDTO = (s: Subscription) => ({
  id: s.id,
  nome: s.nome,
  valor: n(s.valor),
  periodo: s.periodo,
  proximoDebito: dia(s.proximoDebito),
  cardId: s.cardId,
  categoriaId: s.categoriaId,
  status: s.status,
  observacao: s.observacao,
  precoAnterior: nOuNulo(s.precoAnterior),
});

export const ativoDTO = (a: Asset) => ({
  id: a.id,
  nome: a.nome,
  classe: a.classe,
  valor: n(a.valor),
  taxaAnual: n(a.taxaAnual),
  aporteMensal: n(a.aporteMensal),
  metaTaxa: n(a.metaTaxa),
  ordem: a.ordem,
});

export const metaDTO = (g: Goal) => ({
  id: g.id,
  nome: g.nome,
  alvo: n(g.alvo),
  atual: n(g.atual),
  prazoMeses: g.prazoMeses,
  ordem: g.ordem,
});

export const regraDTO = (r: Rule) => ({
  id: r.id,
  termo: r.termo,
  categoriaId: r.categoriaId,
  acertos: r.acertos,
  ordem: r.ordem,
});

export const importacaoDTO = (i: Import) => ({
  id: i.id,
  arquivo: i.arquivo,
  accountId: i.accountId,
  periodoInicio: dia(i.periodoInicio),
  periodoFim: dia(i.periodoFim),
  quantidade: i.quantidade,
  classificados: i.classificados,
  criadoEm: i.criadoEm.toISOString(),
});

export const faturaDTO = (f: Invoice) => ({
  id: f.id,
  cardId: f.cardId,
  competencia: f.competencia,
  fechamento: dia(f.fechamento),
  vencimento: dia(f.vencimento),
  total: n(f.total),
  paga: f.paga,
  pagaEm: f.pagaEm ? f.pagaEm.toISOString() : null,
});

export { dia, n };
