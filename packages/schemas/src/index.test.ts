/**
 * O contrato de validação é usado pela API e pelos formulários do frontend.
 * Um schema frouxo aqui vira dado ruim no banco; um schema rígido demais vira
 * campo que o usuário não consegue preencher. Os dois casos importam.
 */
import { describe, expect, it } from 'vitest';
import {
  assinaturaSchema,
  ativoSchema,
  cartaoSchema,
  categoriaSchema,
  competencia,
  filtroLancamentos,
  lancamentoSchema,
  loginSchema,
  metaSchema,
  projecaoSchema,
  registroSchema,
  valorMonetario,
} from './index.js';

const lancamentoValido = {
  descricao: 'Supermercado',
  valor: 612.4,
  data: '2026-08-08',
  tipo: 'SAIDA',
  categoriaId: 'k2',
  accountId: 'b1',
  responsavel: 'ANA',
};

describe('parsing de valor em pt-BR', () => {
  const schema = valorMonetario();

  it('aceita o texto que o usuário digita', () => {
    expect(schema.parse('1.234,56')).toBeCloseTo(1234.56, 10);
    expect(schema.parse('612,40')).toBeCloseTo(612.4, 10);
    expect(schema.parse('R$ 2.200,00')).toBeCloseTo(2200, 10);
  });

  it('aceita número puro, vindo da API', () => {
    expect(schema.parse(1234.56)).toBeCloseTo(1234.56, 10);
  });

  it('recusa zero, negativo e texto sem número', () => {
    expect(schema.safeParse(0).success).toBe(false);
    expect(schema.safeParse('-50').success).toBe(false);
    expect(schema.safeParse('abc').success).toBe(false);
    expect(schema.safeParse('').success).toBe(false);
  });

  it('devolve mensagem em pt-BR, pronta para exibir no campo', () => {
    const erro = schema.safeParse(0);
    expect(erro.success).toBe(false);
    if (!erro.success) {
      expect(erro.error.issues[0]!.message).toMatch(/valor maior que zero/i);
    }
  });
});

describe('lançamento', () => {
  it('aceita o caso normal', () => {
    expect(lancamentoSchema.safeParse(lancamentoValido).success).toBe(true);
  });

  it('exige conta OU cartão — nunca os dois, nunca nenhum', () => {
    const semOrigem = { ...lancamentoValido, accountId: undefined };
    const comAmbos = { ...lancamentoValido, cardId: 'c1' };
    expect(lancamentoSchema.safeParse(semOrigem).success).toBe(false);
    expect(lancamentoSchema.safeParse(comAmbos).success).toBe(false);

    const soCartao = { ...lancamentoValido, accountId: undefined, cardId: 'c1' };
    expect(lancamentoSchema.safeParse(soCartao).success).toBe(true);
  });

  it('aponta o erro de origem no campo accountId, para o formulário destacar', () => {
    const r = lancamentoSchema.safeParse({ ...lancamentoValido, cardId: 'c1' });
    if (!r.success) expect(r.error.issues[0]!.path).toEqual(['accountId']);
  });

  it('recusa descrição vazia ou só espaços', () => {
    expect(lancamentoSchema.safeParse({ ...lancamentoValido, descricao: '' }).success).toBe(false);
    expect(lancamentoSchema.safeParse({ ...lancamentoValido, descricao: '   ' }).success).toBe(
      false,
    );
  });

  it('recusa data malformada', () => {
    for (const data of ['08/08/2026', '2026-8-8', 'ontem', '']) {
      expect(lancamentoSchema.safeParse({ ...lancamentoValido, data }).success).toBe(false);
    }
  });

  it('recusa parcela atual maior que o total', () => {
    const r = lancamentoSchema.safeParse({
      ...lancamentoValido,
      parcelaAtual: 11,
      parcelaTotal: 10,
    });
    expect(r.success).toBe(false);
  });

  it('aceita parcela válida', () => {
    const r = lancamentoSchema.safeParse({
      ...lancamentoValido,
      parcelaAtual: 3,
      parcelaTotal: 10,
    });
    expect(r.success).toBe(true);
  });
});

describe('categoria', () => {
  const base = { nome: 'Lazer', tipo: 'SAIDA', cor: '#aebf92' };

  it('trata orçamento ausente ou vazio como "sem limite", não como zero', () => {
    for (const orcamentoMensal of [undefined, null, '']) {
      const r = categoriaSchema.safeParse({ ...base, orcamentoMensal });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.orcamentoMensal).toBeNull();
    }
  });

  it('aceita orçamento zero explícito como número', () => {
    const r = categoriaSchema.safeParse({ ...base, orcamentoMensal: 0 });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.orcamentoMensal).toBe(0);
  });

  it('recusa cor fora do formato hex de 6 dígitos', () => {
    for (const cor of ['#fff', 'vermelho', '#GGGGGG', '']) {
      expect(categoriaSchema.safeParse({ ...base, cor }).success).toBe(false);
    }
  });
});

describe('cartão', () => {
  const base = {
    nome: 'Nubank',
    bandeira: 'MASTERCARD',
    final: '4821',
    limite: 12000,
    diaFechamento: 28,
    diaVencimento: 8,
  };

  it('aceita o caso normal', () => {
    expect(cartaoSchema.safeParse(base).success).toBe(true);
  });

  it('exige exatamente 4 dígitos no final, preservando zeros à esquerda', () => {
    expect(cartaoSchema.safeParse({ ...base, final: '042' }).success).toBe(false);
    expect(cartaoSchema.safeParse({ ...base, final: '48210' }).success).toBe(false);
    const r = cartaoSchema.safeParse({ ...base, final: '0042' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.final).toBe('0042');
  });

  it('limita os dias a 1..28 — 29 a 31 não existem em todo mês', () => {
    expect(cartaoSchema.safeParse({ ...base, diaFechamento: 0 }).success).toBe(false);
    expect(cartaoSchema.safeParse({ ...base, diaFechamento: 31 }).success).toBe(false);
    expect(cartaoSchema.safeParse({ ...base, diaVencimento: 28 }).success).toBe(true);
  });
});

describe('assinatura', () => {
  const base = {
    nome: 'Streaming',
    valor: 55.9,
    periodo: 'MENSAL',
    proximoDebito: '2026-09-05',
    categoriaId: 'k6',
    status: 'ATIVA',
  };

  it('aceita valor zero — é o caso do teste grátis', () => {
    const r = assinaturaSchema.safeParse({ ...base, valor: 0, status: 'TESTE' });
    expect(r.success).toBe(true);
  });

  it('recusa período fora dos quatro previstos', () => {
    expect(assinaturaSchema.safeParse({ ...base, periodo: 'QUINZENAL' }).success).toBe(false);
  });
});

describe('ativo', () => {
  const base = {
    nome: 'Tesouro IPCA+',
    classe: 'RENDA_FIXA',
    valor: 42000,
    taxaAnual: 11.2,
    aporteMensal: 400,
    metaTaxa: 10,
  };

  it('aceita taxa negativa — um ativo pode render abaixo de zero', () => {
    expect(ativoSchema.safeParse({ ...base, taxaAnual: -5 }).success).toBe(true);
  });

  it('recusa taxa fora de −100..100', () => {
    expect(ativoSchema.safeParse({ ...base, taxaAnual: 250 }).success).toBe(false);
    expect(ativoSchema.safeParse({ ...base, taxaAnual: -150 }).success).toBe(false);
  });

  it('aceita aporte zero — dá para ter ativo sem aportar todo mês', () => {
    expect(ativoSchema.safeParse({ ...base, aporteMensal: 0 }).success).toBe(true);
  });
});

describe('meta', () => {
  const base = { nome: 'Reserva', alvo: 30000, atual: 18400, prazoMeses: 12 };

  it('exige prazo inteiro de pelo menos 1 mês', () => {
    expect(metaSchema.safeParse({ ...base, prazoMeses: 0 }).success).toBe(false);
    expect(metaSchema.safeParse({ ...base, prazoMeses: 2.5 }).success).toBe(false);
    expect(metaSchema.safeParse({ ...base, prazoMeses: 1 }).success).toBe(true);
  });

  it('aceita já guardado zero, mas exige alvo positivo', () => {
    expect(metaSchema.safeParse({ ...base, atual: 0 }).success).toBe(true);
    expect(metaSchema.safeParse({ ...base, alvo: 0 }).success).toBe(false);
  });
});

describe('auth', () => {
  it('normaliza e-mail para minúsculas e sem espaços', () => {
    const r = loginSchema.safeParse({ email: '  ANA@Raiz.APP  ', senha: 'x' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe('ana@raiz.app');
  });

  it('recusa e-mail inválido', () => {
    expect(loginSchema.safeParse({ email: 'nao-e-email', senha: 'x' }).success).toBe(false);
  });

  it('exige senha de pelo menos 8 caracteres no registro', () => {
    const base = { nome: 'Ana', email: 'ana@raiz.app' };
    expect(registroSchema.safeParse({ ...base, senha: '1234567' }).success).toBe(false);
    expect(registroSchema.safeParse({ ...base, senha: '12345678' }).success).toBe(true);
  });

  it('no login não exige tamanho de senha — quem valida é o hash', () => {
    // Exigir 8 caracteres no login vazaria a regra de senha para quem só tenta entrar.
    expect(loginSchema.safeParse({ email: 'ana@raiz.app', senha: 'x' }).success).toBe(true);
  });
});

describe('competência e filtros', () => {
  it('aceita AAAA-MM e recusa o resto', () => {
    expect(competencia.safeParse('2026-08').success).toBe(true);
    expect(competencia.safeParse('2026-13').success).toBe(false);
    expect(competencia.safeParse('2026-00').success).toBe(false);
    expect(competencia.safeParse('agosto').success).toBe(false);
    expect(competencia.safeParse('2026-8').success).toBe(false);
  });

  it('filtro de lançamentos assume "todos" quando o tipo não vem', () => {
    const r = filtroLancamentos.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.tipo).toBe('todos');
  });

  it('projeção limita prazo, ajuste e aporte extra às faixas dos sliders', () => {
    expect(projecaoSchema.safeParse({ anos: 10 }).success).toBe(true);
    expect(projecaoSchema.safeParse({ anos: 31 }).success).toBe(false);
    expect(projecaoSchema.safeParse({ anos: 10, ajusteTaxa: 5 }).success).toBe(false);
    expect(projecaoSchema.safeParse({ anos: 10, ajusteTaxa: -4 }).success).toBe(false);
    expect(projecaoSchema.safeParse({ anos: 10, aporteExtra: -1 }).success).toBe(false);
  });

  it('projeção assume ajuste e aporte extra zerados por padrão', () => {
    const r = projecaoSchema.safeParse({ anos: 10 });
    if (r.success) {
      expect(r.data.ajusteTaxa).toBe(0);
      expect(r.data.aporteExtra).toBe(0);
    }
  });
});
