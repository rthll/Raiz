import { describe, expect, it } from 'vitest';
import { PRIVACY_MASK, formatBRL, formatPercent, formatSignedBRL, parseBRL } from './money.js';
import { matchRule, normalizeDescription, transactionFingerprint } from './fingerprint.js';

describe('formatBRL', () => {
  it('formata em pt-BR com dois decimais por padrao', () => {
    expect(formatBRL(21881.25)).toBe('R$ 21.881,25');
    expect(formatBRL(7783.7)).toBe('R$ 7.783,70');
    expect(formatBRL(0)).toBe('R$ 0,00');
  });

  it('usa zero decimais em valores grandes de projecao', () => {
    expect(formatBRL(164681, { decimals: 0 })).toBe('R$ 164.681');
  });

  it('mascara tudo no modo privacidade', () => {
    expect(formatBRL(21881.25, { privacy: true })).toBe(PRIVACY_MASK);
    expect(formatBRL(0, { privacy: true, decimals: 0 })).toBe(PRIVACY_MASK);
  });

  it('trata nulo, indefinido e NaN como zero', () => {
    expect(formatBRL(null)).toBe('R$ 0,00');
    expect(formatBRL(undefined)).toBe('R$ 0,00');
    expect(formatBRL(Number.NaN)).toBe('R$ 0,00');
  });

  it('assina entradas e saidas', () => {
    expect(formatSignedBRL(7400, 'entrada')).toBe('+ R$ 7.400,00');
    expect(formatSignedBRL(2200, 'saida')).toBe('– R$ 2.200,00');
  });
});

describe('parseBRL', () => {
  it('le o formato pt-BR digitado pelo usuario', () => {
    expect(parseBRL('1.234,56')).toBeCloseTo(1234.56, 10);
    expect(parseBRL('612,40')).toBeCloseTo(612.4, 10);
    expect(parseBRL('R$ 2.200,00')).toBeCloseTo(2200, 10);
    expect(parseBRL('1.000.000,99')).toBeCloseTo(1000000.99, 10);
  });

  it('aceita valores sem separador de milhar e sem decimais', () => {
    expect(parseBRL('450')).toBe(450);
    expect(parseBRL('450,5')).toBeCloseTo(450.5, 10);
  });

  it('preserva o sinal negativo', () => {
    expect(parseBRL('-1.234,56')).toBeCloseTo(-1234.56, 10);
    expect(parseBRL('R$ -80,00')).toBeCloseTo(-80, 10);
  });

  it('devolve zero para entrada vazia ou invalida em vez de NaN', () => {
    expect(parseBRL('')).toBe(0);
    expect(parseBRL('abc')).toBe(0);
    expect(parseBRL(null)).toBe(0);
    expect(parseBRL(undefined)).toBe(0);
    expect(parseBRL(Number.NaN)).toBe(0);
  });

  it('passa numeros adiante sem alteracao', () => {
    expect(parseBRL(1234.56)).toBe(1234.56);
  });

  it('faz round-trip com formatBRL', () => {
    for (const v of [0, 1, 612.4, 21881.25, 1000000.99]) {
      expect(parseBRL(formatBRL(v))).toBeCloseTo(v, 2);
    }
  });
});

describe('formatPercent', () => {
  it('usa virgula como separador decimal', () => {
    expect(formatPercent(45.9)).toBe('46%');
    expect(formatPercent(11.05, 1)).toBe('11,1%');
    expect(formatPercent(0)).toBe('0%');
  });
});

describe('normalizacao e dedupe', () => {
  it('remove acento, caixa e pontuacao da descricao', () => {
    expect(normalizeDescription('Supermercado Vila')).toBe('supermercado vila');
    expect(normalizeDescription('ALIMENTAÇÃO  --  Feira')).toBe('alimentacao feira');
    expect(normalizeDescription('Uber*Trip 12/08')).toBe('uber trip 12 08');
  });

  it('gera o mesmo fingerprint para o mesmo lancamento escrito de formas diferentes', () => {
    const a = transactionFingerprint({
      data: '2026-08-08',
      valor: 612.4,
      descricao: 'SUPERMERCADO VILA',
      accountId: 'b1',
    });
    const b = transactionFingerprint({
      data: '2026-08-08',
      valor: -612.4,
      descricao: 'Supermercado  Vila',
      accountId: 'b1',
    });
    expect(a).toBe(b);
  });

  it('separa o mesmo lancamento em contas diferentes', () => {
    const base = { data: '2026-08-08', valor: 612.4, descricao: 'Supermercado Vila' };
    expect(transactionFingerprint({ ...base, accountId: 'b1' })).not.toBe(
      transactionFingerprint({ ...base, accountId: 'b2' }),
    );
  });

  it('distingue centavos', () => {
    const base = { data: '2026-08-08', descricao: 'Feira', accountId: 'b1' };
    expect(transactionFingerprint({ ...base, valor: 148.7 })).not.toBe(
      transactionFingerprint({ ...base, valor: 148.71 }),
    );
  });
});

describe('regras de classificacao automatica', () => {
  const regras = [
    { termo: 'SUPERMERC', cat: 'Alimentação' },
    { termo: 'UBER / 99', cat: 'Transporte' },
    { termo: 'DROGA', cat: 'Saúde' },
  ];

  it('casa pelo trecho contido na descricao, ignorando caixa e acento', () => {
    expect(matchRule('Supermercado Vila', regras)?.cat).toBe('Alimentação');
    expect(matchRule('DROGARIA CENTRAL', regras)?.cat).toBe('Saúde');
  });

  it('aceita variantes separadas por barra', () => {
    expect(matchRule('UBER *TRIP', regras)?.cat).toBe('Transporte');
    expect(matchRule('99 POP SAO PAULO', regras)?.cat).toBe('Transporte');
  });

  it('devolve null quando nada bate', () => {
    expect(matchRule('Cinema e jantar', regras)).toBeNull();
  });

  it('respeita a ordem das regras no empate', () => {
    const ordenadas = [
      { termo: 'MERCADO', cat: 'Alimentação' },
      { termo: 'MERCADO LIVRE', cat: 'Lazer' },
    ];
    expect(matchRule('MERCADO LIVRE', ordenadas)?.cat).toBe('Alimentação');
  });
});
