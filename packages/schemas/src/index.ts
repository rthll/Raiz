import { parseBRL } from '@raiz/core';
import { z } from 'zod';

/**
 * Schemas de validação compartilhados entre a API e os formulários do frontend.
 *
 * Uma definição só para os dois lados: a mensagem que o usuário vê no campo é
 * literalmente a mesma que a API devolveria se ele burlasse o formulário.
 *
 * Todas as mensagens em pt-BR — vão direto para a tela.
 */

// ────────────────────────────────────────────────────────────── primitivos

/**
 * Aceita tanto número quanto o texto que o usuário digita em pt-BR
 * (`"1.234,56"`), porque o mesmo schema valida o formulário e o corpo da
 * requisição. A conversão usa `parseBRL` de `@raiz/core` — a mesma do resto do
 * sistema.
 */
export const valorMonetario = (mensagem = 'Informe um valor maior que zero.') =>
  z
    .union([z.number(), z.string()])
    .transform((v) => (typeof v === 'number' ? v : parseBRL(v)))
    .pipe(z.number().finite().positive(mensagem));

/** Como acima, mas aceita zero — para saldos e valores já guardados. */
export const valorNaoNegativo = (mensagem = 'Não pode ser negativo.') =>
  z
    .union([z.number(), z.string()])
    .transform((v) => (typeof v === 'number' ? v : parseBRL(v)))
    .pipe(z.number().finite().min(0, mensagem));

/** Opcional que trata string vazia como ausência — é o que um `<input>` manda. */
export const valorOpcional = () =>
  z
    .union([z.number(), z.string(), z.null(), z.undefined()])
    .transform((v) => {
      if (v === null || v === undefined || v === '') return null;
      return typeof v === 'number' ? v : parseBRL(v);
    })
    .refine((v) => v === null || (Number.isFinite(v) && v >= 0), 'Não pode ser negativo.');

/** Taxa em pontos percentuais. O handoff limita a −100..100. */
export const taxaPercentual = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === 'number' ? v : parseBRL(v)))
  .pipe(z.number().finite().min(-100, 'Mínimo −100%.').max(100, 'Máximo 100%.'));

export const dataISO = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use uma data válida.')
  .refine((s) => !Number.isNaN(Date.parse(s)), 'Use uma data válida.');

/** Competência `YYYY-MM`, o recorte de mês que todas as telas usam. */
export const competencia = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use o formato AAAA-MM.');

export const nomeObrigatorio = (rotulo = 'Nome') =>
  z.string().trim().min(1, `${rotulo} é obrigatório.`).max(120, `${rotulo} é longo demais.`);

const corHex = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Escolha uma das cores disponíveis.');

const id = z.string().min(1, 'Selecione uma opção.');

// ───────────────────────────────────────────────────────────────── enums

export const tipoTransacao = z.enum(['ENTRADA', 'SAIDA']);
export const responsavel = z.enum(['ANA', 'BRUNO', 'CONJUNTA']);
export const tipoCategoria = z.enum(['ENTRADA', 'SAIDA']);
export const tipoConta = z.enum(['CORRENTE', 'CONJUNTA', 'POUPANCA']);
export const bandeira = z.enum(['VISA', 'MASTERCARD', 'ELO', 'AMEX']);
export const periodoAssinatura = z.enum(['MENSAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL']);
export const statusAssinatura = z.enum(['ATIVA', 'PAUSADA', 'TESTE']);
export const classeAtivo = z.enum([
  'RENDA_FIXA',
  'FUNDOS_IMOBILIARIOS',
  'ACOES_EXTERIOR',
  'ACOES_BRASIL',
  'CRIPTO',
]);

// ─────────────────────────────────────────────────────────────────── auth

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Informe um e-mail válido.'),
  senha: z.string().min(1, 'Informe sua senha.'),
});

export const registroSchema = z.object({
  nome: nomeObrigatorio(),
  email: z.string().trim().toLowerCase().email('Informe um e-mail válido.'),
  senha: z.string().min(8, 'A senha precisa de pelo menos 8 caracteres.'),
  /** Nome do household a criar. Ausente quando o convite for implementado. */
  household: z.string().trim().min(1).max(120).optional(),
});

// ────────────────────────────────────────────────────────────── entidades

export const contaSchema = z.object({
  nome: nomeObrigatorio(),
  tipo: tipoConta,
  dono: z.string().trim().min(1, 'Informe o dono da conta.').max(120),
  saldo: valorNaoNegativo(),
});

export const cartaoSchema = z.object({
  nome: nomeObrigatorio('Apelido'),
  bandeira,
  final: z.string().regex(/^\d{4}$/, 'Informe os 4 últimos dígitos.'),
  limite: valorMonetario('Informe o limite do cartão.'),
  diaFechamento: z.coerce.number().int().min(1, 'Entre 1 e 28.').max(28, 'Entre 1 e 28.'),
  diaVencimento: z.coerce.number().int().min(1, 'Entre 1 e 28.').max(28, 'Entre 1 e 28.'),
  temaEscuro: z.boolean().optional().default(false),
});

export const categoriaSchema = z.object({
  nome: nomeObrigatorio(),
  tipo: tipoCategoria,
  cor: corHex,
  orcamentoMensal: valorOpcional(),
});

export const lancamentoSchema = z
  .object({
    descricao: nomeObrigatorio('Descrição'),
    valor: valorMonetario(),
    data: dataISO,
    tipo: tipoTransacao,
    categoriaId: id,
    accountId: z.string().nullable().optional(),
    cardId: z.string().nullable().optional(),
    responsavel,
    parcelaAtual: z.coerce.number().int().positive().nullable().optional(),
    parcelaTotal: z.coerce.number().int().positive().nullable().optional(),
  })
  .refine((v) => !!v.accountId !== !!v.cardId, {
    message: 'Escolha uma conta ou um cartão.',
    path: ['accountId'],
  })
  .refine((v) => !v.parcelaAtual || !v.parcelaTotal || v.parcelaAtual <= v.parcelaTotal, {
    message: 'A parcela atual não pode passar do total.',
    path: ['parcelaAtual'],
  });

export const assinaturaSchema = z.object({
  nome: nomeObrigatorio('Serviço'),
  // Teste grátis custa zero, então aqui o zero é legítimo.
  valor: valorNaoNegativo(),
  periodo: periodoAssinatura,
  proximoDebito: dataISO,
  cardId: z.string().nullable().optional(),
  categoriaId: id,
  status: statusAssinatura,
  observacao: z.string().trim().max(500).nullable().optional(),
});

export const ativoSchema = z.object({
  nome: nomeObrigatorio('Ativo'),
  classe: classeAtivo,
  valor: valorMonetario('Informe o valor atual.'),
  taxaAnual: taxaPercentual,
  aporteMensal: valorNaoNegativo(),
  metaTaxa: taxaPercentual,
});

export const metaSchema = z.object({
  nome: nomeObrigatorio('Meta'),
  alvo: valorMonetario('Informe o valor alvo.'),
  atual: valorNaoNegativo(),
  prazoMeses: z.coerce
    .number()
    .int('Use um número inteiro de meses.')
    .min(1, 'O prazo precisa ser de pelo menos 1 mês.')
    .max(600, 'Prazo longo demais.'),
});

export const regraSchema = z.object({
  termo: z.string().trim().min(2, 'O termo precisa de pelo menos 2 caracteres.').max(80),
  categoriaId: id,
});

// ────────────────────────────────────────────────────────── consultas

export const filtroLancamentos = z.object({
  mes: competencia.optional(),
  tipo: z.enum(['todos', 'ENTRADA', 'SAIDA']).optional().default('todos'),
  categoriaId: z.string().optional(),
  cardId: z.string().optional(),
  accountId: z.string().optional(),
  q: z.string().trim().optional(),
});

export const projecaoSchema = z.object({
  anos: z.coerce.number().int().min(1, 'Mínimo 1 ano.').max(30, 'Máximo 30 anos.'),
  ajusteTaxa: z.coerce.number().min(-3).max(4).optional().default(0),
  aporteExtra: z.coerce.number().min(0).max(100000).optional().default(0),
});

export const preferenciasSchema = z.object({
  modoPrivacidade: z.boolean().optional(),
  modoCasal: z.boolean().optional(),
  alertasVencimento: z.boolean().optional(),
});

// ────────────────────────────────────────────────────────────────── tipos

export type LoginInput = z.infer<typeof loginSchema>;
export type RegistroInput = z.infer<typeof registroSchema>;
export type ContaInput = z.infer<typeof contaSchema>;
export type CartaoInput = z.infer<typeof cartaoSchema>;
export type CategoriaInput = z.infer<typeof categoriaSchema>;
export type LancamentoInput = z.infer<typeof lancamentoSchema>;
export type AssinaturaInput = z.infer<typeof assinaturaSchema>;
export type AtivoInput = z.infer<typeof ativoSchema>;
export type MetaInput = z.infer<typeof metaSchema>;
export type RegraInput = z.infer<typeof regraSchema>;
export type FiltroLancamentos = z.infer<typeof filtroLancamentos>;
export type ProjecaoInput = z.infer<typeof projecaoSchema>;
export type PreferenciasInput = z.infer<typeof preferenciasSchema>;
