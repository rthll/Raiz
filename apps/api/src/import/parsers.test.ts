/**
 * Testes dos parsers de extrato.
 *
 * Cada banco exporta diferente, então o valor destes testes está na variedade:
 * separadores, cabeçalhos, formatos de data e de número. Um parser que só
 * entende um formato dá erro logo; um que interpreta *errado* grava valor torto
 * no banco em silêncio — é isso que estes testes barram.
 */
import { describe, expect, it } from 'vitest';
import {
  ExtratoInvalidoError,
  normalizarData,
  normalizarValor,
  parseCSV,
  parseExtrato,
  parseOFX,
} from './parsers.js';

describe('normalizarData', () => {
  it('aceita os formatos que os bancos usam', () => {
    expect(normalizarData('08/08/2026')).toBe('2026-08-08');
    expect(normalizarData('8/8/2026')).toBe('2026-08-08');
    expect(normalizarData('2026-08-08')).toBe('2026-08-08');
    expect(normalizarData('20260808')).toBe('2026-08-08');
    expect(normalizarData('20260808120000[-3:BRT]')).toBe('2026-08-08');
  });

  it('resolve ano de dois dígitos pela janela 70/69', () => {
    expect(normalizarData('08/08/26')).toBe('2026-08-08');
    expect(normalizarData('08/08/99')).toBe('1999-08-08');
  });

  it('rejeita data que não existe, em vez de normalizar em silêncio', () => {
    // O Date transformaria 31/02 em 03/03 sem avisar.
    expect(normalizarData('31/02/2026')).toBeNull();
    expect(normalizarData('32/01/2026')).toBeNull();
    expect(normalizarData('01/13/2026')).toBeNull();
  });

  it('rejeita lixo', () => {
    expect(normalizarData('')).toBeNull();
    expect(normalizarData('ontem')).toBeNull();
    expect(normalizarData('--')).toBeNull();
  });
});

describe('normalizarValor', () => {
  it('lê pt-BR', () => {
    expect(normalizarValor('1.234,56')).toBeCloseTo(1234.56, 10);
    expect(normalizarValor('612,40')).toBeCloseTo(612.4, 10);
    expect(normalizarValor('R$ 2.200,00')).toBeCloseTo(2200, 10);
  });

  it('lê en-US', () => {
    expect(normalizarValor('1,234.56')).toBeCloseTo(1234.56, 10);
    expect(normalizarValor('612.40')).toBeCloseTo(612.4, 10);
  });

  it('desfaz a ambiguidade de "1.234" pelo tamanho do grupo final', () => {
    // Três dígitos depois do ponto: separador de milhar.
    expect(normalizarValor('1.234')).toBe(1234);
    // Dois dígitos: separador decimal.
    expect(normalizarValor('1.23')).toBeCloseTo(1.23, 10);
  });

  it('entende negativo com sinal e com parênteses', () => {
    expect(normalizarValor('-612,40')).toBeCloseTo(-612.4, 10);
    expect(normalizarValor('(612,40)')).toBeCloseTo(-612.4, 10);
  });

  it('rejeita texto que não é número', () => {
    expect(normalizarValor('')).toBeNull();
    expect(normalizarValor('n/d')).toBeNull();
    expect(normalizarValor('--')).toBeNull();
  });
});

describe('parseCSV', () => {
  it('lê o formato mais comum no Brasil: ponto e vírgula e valores em pt-BR', () => {
    const csv = [
      'Data;Histórico;Valor',
      '01/08/2026;Salário Ana;7400,00',
      '05/08/2026;Aluguel;-2200,00',
    ].join('\n');

    const { linhas, formato } = parseCSV(csv);
    expect(formato).toBe('CSV');
    expect(linhas).toEqual([
      { data: '2026-08-01', descricao: 'Salário Ana', valor: 7400, tipo: 'ENTRADA' },
      { data: '2026-08-05', descricao: 'Aluguel', valor: 2200, tipo: 'SAIDA' },
    ]);
  });

  it('lê vírgula como separador quando o valor não usa vírgula decimal', () => {
    const csv = ['date,description,amount', '2026-08-01,Salary,7400.00'].join('\n');
    expect(parseCSV(csv).linhas[0]).toEqual({
      data: '2026-08-01',
      descricao: 'Salary',
      valor: 7400,
      tipo: 'ENTRADA',
    });
  });

  it('respeita aspas: vírgula dentro do campo não divide a linha', () => {
    const csv = ['Data,Descrição,Valor', '"01/08/2026","Mercado, Vila Nova","-612.40"'].join('\n');
    expect(parseCSV(csv).linhas[0]!.descricao).toBe('Mercado, Vila Nova');
  });

  it('aceita colunas separadas de crédito e débito', () => {
    const csv = [
      'Data;Histórico;Crédito;Débito',
      '01/08/2026;Salário;7400,00;',
      '05/08/2026;Aluguel;;2200,00',
    ].join('\n');

    const { linhas } = parseCSV(csv);
    expect(linhas[0]).toMatchObject({ valor: 7400, tipo: 'ENTRADA' });
    expect(linhas[1]).toMatchObject({ valor: 2200, tipo: 'SAIDA' });
  });

  it('reconhece cabeçalhos com nomes alternativos e acentuação', () => {
    const csv = ['Data Lançamento;Lançamento;Valor (R$)', '01/08/2026;Feira;-148,70'].join('\n');
    expect(parseCSV(csv).linhas).toHaveLength(1);
  });

  it('engole o BOM que o Excel adiciona', () => {
    const csv = '﻿Data;Histórico;Valor\n01/08/2026;Teste;-10,00';
    expect(parseCSV(csv).linhas).toHaveLength(1);
  });

  it('aceita quebra de linha do Windows', () => {
    const csv = 'Data;Histórico;Valor\r\n01/08/2026;Teste;-10,00\r\n';
    expect(parseCSV(csv).linhas).toHaveLength(1);
  });

  it('pula linhas ruins e diz por quê, em vez de abortar o arquivo inteiro', () => {
    const csv = [
      'Data;Histórico;Valor',
      '01/08/2026;Bom;-10,00',
      'data-ruim;Ruim;-10,00',
      '02/08/2026;;-10,00',
      '03/08/2026;Zero;0,00',
      '04/08/2026;Bom também;-20,00',
    ].join('\n');

    const { linhas, ignoradas } = parseCSV(csv);
    expect(linhas).toHaveLength(2);
    expect(ignoradas.map((i) => i.motivo)).toEqual([
      'data inválida',
      'descrição vazia',
      'valor inválido ou zero',
    ]);
    // A linha original acompanha o motivo, para a pessoa conseguir corrigir.
    expect(ignoradas[0]!.linha).toBe(3);
  });

  it('avisa qual coluna faltou, em vez de um erro genérico', () => {
    expect(() => parseCSV('Foo;Bar\n1;2')).toThrow(/coluna de data/i);
    expect(() => parseCSV('Data;Bar\n01/08/2026;2')).toThrow(/coluna de descrição/i);
    expect(() => parseCSV('Data;Histórico\n01/08/2026;Teste')).toThrow(/coluna de valor/i);
  });

  it('recusa arquivo sem lançamento nenhum', () => {
    expect(() => parseCSV('Data;Histórico;Valor')).toThrow(ExtratoInvalidoError);
    expect(() => parseCSV('Data;Histórico;Valor\nlixo;;')).toThrow(/Nenhum lançamento válido/);
  });
});

describe('parseOFX', () => {
  const ofx = `
OFXHEADER:100
DATA:OFXSGML
<OFX>
<BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260808120000[-3:BRT]
<TRNAMT>-612.40
<FITID>202608080001
<MEMO>SUPERMERCADO VILA
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260801
<TRNAMT>7400.00
<FITID>202608010001
<NAME>SALARIO
</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1>
</OFX>`;

  it('lê tags sem fechamento — o SGML que os bancos realmente exportam', () => {
    const { linhas, formato } = parseOFX(ofx);
    expect(formato).toBe('OFX');
    expect(linhas).toHaveLength(2);
  });

  it('usa o sinal do TRNAMT para decidir entrada ou saída', () => {
    const { linhas } = parseOFX(ofx);
    expect(linhas[0]).toMatchObject({
      data: '2026-08-08',
      descricao: 'SUPERMERCADO VILA',
      valor: 612.4,
      tipo: 'SAIDA',
      idExterno: '202608080001',
    });
    expect(linhas[1]).toMatchObject({ valor: 7400, tipo: 'ENTRADA' });
  });

  it('cai para NAME quando não há MEMO', () => {
    expect(parseOFX(ofx).linhas[1]!.descricao).toBe('SALARIO');
  });

  it('recusa arquivo sem STMTTRN', () => {
    expect(() => parseOFX('<OFX><SIGNONMSGSRSV1></SIGNONMSGSRSV1></OFX>')).toThrow(
      /não contém lançamentos/i,
    );
  });
});

describe('parseExtrato', () => {
  it('escolhe o parser pelo conteúdo, não pela extensão', () => {
    const ofx = '<OFX><STMTTRN><DTPOSTED>20260801<TRNAMT>-10.00<MEMO>Teste</STMTTRN></OFX>';
    // Extensão .csv, conteúdo OFX: o conteúdo manda.
    expect(parseExtrato(ofx, 'extrato.csv').formato).toBe('OFX');

    const csv = 'Data;Histórico;Valor\n01/08/2026;Teste;-10,00';
    expect(parseExtrato(csv, 'extrato.csv').formato).toBe('CSV');
  });

  it('avisa quando um .ofx não é OFX de verdade', () => {
    const csv = 'Data;Histórico;Valor\n01/08/2026;Teste;-10,00';
    expect(() => parseExtrato(csv, 'extrato.ofx')).toThrow(/extensão \.ofx/i);
  });
});
