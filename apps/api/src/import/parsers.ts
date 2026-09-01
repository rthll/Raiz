import { removerAcentos } from '@raiz/core';

/**
 * Leitura de extratos bancários.
 *
 * Cada banco exporta de um jeito. Em vez de um parser por banco, estes dois
 * (CSV e OFX) reconhecem as variações comuns: separador `,` ou `;`, cabeçalhos
 * com nomes diferentes para a mesma coluna, datas em três formatos, valor em
 * pt-BR ou en-US, e débito/crédito em colunas separadas.
 *
 * Regra que atravessa tudo: **o sinal decide o tipo**. Valor negativo é saída,
 * positivo é entrada; o `valor` guardado é sempre absoluto.
 */

export interface LinhaExtrato {
  /** Data no formato ISO `YYYY-MM-DD`. */
  data: string;
  descricao: string;
  /** Sempre positivo. O tipo carrega o sinal. */
  valor: number;
  tipo: 'ENTRADA' | 'SAIDA';
  /** Identificador do banco (`FITID` no OFX), quando existir. */
  idExterno?: string;
}

export interface ResultadoParse {
  linhas: LinhaExtrato[];
  /** Linhas que não deu para interpretar, com o motivo. */
  ignoradas: Array<{ linha: number; conteudo: string; motivo: string }>;
  formato: 'CSV' | 'OFX';
}

export class ExtratoInvalidoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExtratoInvalidoError';
  }
}

// ────────────────────────────────────────────────────────────────── datas

/**
 * Aceita `dd/MM/yyyy`, `dd/MM/yy`, `yyyy-MM-dd` e `yyyyMMdd` (OFX).
 * Devolve `null` em vez de uma data inválida — quem chama decide o que fazer.
 */
export function normalizarData(bruto: string): string | null {
  const texto = bruto.trim();
  if (!texto) return null;

  let ano: number;
  let mes: number;
  let dia: number;

  const barra = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/.exec(texto);
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(texto);
  const compacto = /^(\d{4})(\d{2})(\d{2})/.exec(texto);

  if (barra) {
    dia = Number(barra[1]);
    mes = Number(barra[2]);
    const anoBruto = Number(barra[3]);
    // Ano de dois dígitos: 70–99 vira 19xx, 00–69 vira 20xx.
    ano = barra[3]!.length === 2 ? (anoBruto >= 70 ? 1900 + anoBruto : 2000 + anoBruto) : anoBruto;
  } else if (iso) {
    ano = Number(iso[1]);
    mes = Number(iso[2]);
    dia = Number(iso[3]);
  } else if (compacto) {
    ano = Number(compacto[1]);
    mes = Number(compacto[2]);
    dia = Number(compacto[3]);
  } else {
    return null;
  }

  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  // Rejeita 31/02 e afins: o Date normaliza em silêncio, e aqui não pode.
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  if (d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null;

  return d.toISOString().slice(0, 10);
}

// ───────────────────────────────────────────────────────────────── valores

/**
 * Lê o valor de um extrato, em pt-BR ou en-US.
 *
 * A ambiguidade real é `1.234` — mil e duzentos em pt-BR, um vírgula duzentos
 * em en-US. A decisão usa o **último separador**: se o que vem depois dele tem
 * exatamente 3 dígitos e não há vírgula na string, é separador de milhar.
 */
export function normalizarValor(bruto: string): number | null {
  const texto = bruto.trim().replace(/[R$\s ]/gi, '');
  if (!texto) return null;

  const negativo = texto.startsWith('-') || /\(.*\)/.test(texto);
  const limpo = texto.replace(/[()-]/g, '');
  if (!/^[\d.,]+$/.test(limpo)) return null;

  const temVirgula = limpo.includes(',');
  const temPonto = limpo.includes('.');

  let normalizado: string;
  if (temVirgula && temPonto) {
    // O que aparece por último é o separador decimal.
    normalizado =
      limpo.lastIndexOf(',') > limpo.lastIndexOf('.')
        ? limpo.replace(/\./g, '').replace(',', '.')
        : limpo.replace(/,/g, '');
  } else if (temVirgula) {
    normalizado = limpo.replace(',', '.');
  } else if (temPonto) {
    const depois = limpo.slice(limpo.lastIndexOf('.') + 1);
    // "1.234" é milhar; "1.23" é decimal.
    normalizado = depois.length === 3 ? limpo.replace(/\./g, '') : limpo;
  } else {
    normalizado = limpo;
  }

  const numero = Number.parseFloat(normalizado);
  if (!Number.isFinite(numero)) return null;
  return negativo ? -numero : numero;
}

// ────────────────────────────────────────────────────────────────── CSV

/** Nomes que os bancos brasileiros usam para a mesma coluna. */
const COLUNAS = {
  data: ['data', 'data lancamento', 'data lançamento', 'data movimento', 'dt', 'date'],
  descricao: ['descricao', 'descrição', 'historico', 'histórico', 'lancamento', 'lançamento', 'memo', 'detalhes', 'description'],
  valor: ['valor', 'valor (r$)', 'amount', 'montante'],
  credito: ['credito', 'crédito', 'entrada', 'receita'],
  debito: ['debito', 'débito', 'saida', 'saída', 'despesa'],
};

/** Reusa `removerAcentos` de `@raiz/core`: uma implementação disso no sistema. */
const semAcento = (s: string) => removerAcentos(s).toLowerCase().trim();

function acharColuna(cabecalho: string[], candidatos: string[]): number {
  const normalizado = cabecalho.map(semAcento);
  for (const candidato of candidatos.map(semAcento)) {
    const i = normalizado.indexOf(candidato);
    if (i >= 0) return i;
  }
  // Nenhum nome exato: aceita quem contém o termo ("data da compra").
  for (const candidato of candidatos.map(semAcento)) {
    const i = normalizado.findIndex((c) => c.includes(candidato));
    if (i >= 0) return i;
  }
  return -1;
}

/** Divide uma linha de CSV respeitando aspas e o separador escolhido. */
function dividirLinha(linha: string, separador: string): string[] {
  const campos: string[] = [];
  let atual = '';
  let dentroDeAspas = false;

  for (let i = 0; i < linha.length; i++) {
    const c = linha[i]!;
    if (c === '"') {
      // Aspas duplas escapam uma aspa literal.
      if (dentroDeAspas && linha[i + 1] === '"') {
        atual += '"';
        i++;
      } else {
        dentroDeAspas = !dentroDeAspas;
      }
    } else if (c === separador && !dentroDeAspas) {
      campos.push(atual);
      atual = '';
    } else {
      atual += c;
    }
  }
  campos.push(atual);
  return campos.map((c) => c.trim());
}

/** O separador é o que aparece mais vezes no cabeçalho: `;` no Brasil, `,` fora. */
function detectarSeparador(cabecalho: string): string {
  const pontoVirgula = (cabecalho.match(/;/g) ?? []).length;
  const virgula = (cabecalho.match(/,/g) ?? []).length;
  const tab = (cabecalho.match(/\t/g) ?? []).length;
  if (tab > pontoVirgula && tab > virgula) return '\t';
  return pontoVirgula >= virgula ? ';' : ',';
}

export function parseCSV(conteudo: string): ResultadoParse {
  const linhas = conteudo
    .replace(/^﻿/, '') // BOM que o Excel adiciona
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);

  if (linhas.length < 2) {
    throw new ExtratoInvalidoError('O arquivo não tem cabeçalho e pelo menos um lançamento.');
  }

  const separador = detectarSeparador(linhas[0]!);
  const cabecalho = dividirLinha(linhas[0]!, separador);

  const iData = acharColuna(cabecalho, COLUNAS.data);
  const iDescricao = acharColuna(cabecalho, COLUNAS.descricao);
  const iValor = acharColuna(cabecalho, COLUNAS.valor);
  const iCredito = acharColuna(cabecalho, COLUNAS.credito);
  const iDebito = acharColuna(cabecalho, COLUNAS.debito);

  if (iData < 0) {
    throw new ExtratoInvalidoError('Não encontrei a coluna de data no arquivo.');
  }
  if (iDescricao < 0) {
    throw new ExtratoInvalidoError('Não encontrei a coluna de descrição no arquivo.');
  }
  if (iValor < 0 && iCredito < 0 && iDebito < 0) {
    throw new ExtratoInvalidoError('Não encontrei a coluna de valor no arquivo.');
  }

  const resultado: LinhaExtrato[] = [];
  const ignoradas: ResultadoParse['ignoradas'] = [];

  for (let n = 1; n < linhas.length; n++) {
    const bruta = linhas[n]!;
    const campos = dividirLinha(bruta, separador);

    const data = normalizarData(campos[iData] ?? '');
    if (!data) {
      ignoradas.push({ linha: n + 1, conteudo: bruta, motivo: 'data inválida' });
      continue;
    }

    const descricao = (campos[iDescricao] ?? '').trim();
    if (!descricao) {
      ignoradas.push({ linha: n + 1, conteudo: bruta, motivo: 'descrição vazia' });
      continue;
    }

    // Coluna única de valor, ou colunas separadas de crédito e débito.
    let valorBruto: number | null = null;
    if (iValor >= 0) {
      valorBruto = normalizarValor(campos[iValor] ?? '');
    } else {
      const credito = iCredito >= 0 ? normalizarValor(campos[iCredito] ?? '') : null;
      const debito = iDebito >= 0 ? normalizarValor(campos[iDebito] ?? '') : null;
      if (credito) valorBruto = Math.abs(credito);
      else if (debito) valorBruto = -Math.abs(debito);
    }

    if (valorBruto === null || valorBruto === 0) {
      ignoradas.push({ linha: n + 1, conteudo: bruta, motivo: 'valor inválido ou zero' });
      continue;
    }

    resultado.push({
      data,
      descricao,
      valor: Math.abs(valorBruto),
      tipo: valorBruto < 0 ? 'SAIDA' : 'ENTRADA',
    });
  }

  if (resultado.length === 0) {
    throw new ExtratoInvalidoError('Nenhum lançamento válido foi encontrado no arquivo.');
  }

  return { linhas: resultado, ignoradas, formato: 'CSV' };
}

// ────────────────────────────────────────────────────────────────── OFX

/**
 * OFX é SGML: as tags costumam vir sem fechamento (`<MEMO>Texto` e ponto final).
 * Por isso a leitura é por regex sobre cada bloco `<STMTTRN>`, e não por um
 * parser de XML — que engasgaria no primeiro arquivo real.
 */
function campoOFX(bloco: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i');
  const achado = regex.exec(bloco);
  return achado ? achado[1]!.trim() : null;
}

export function parseOFX(conteudo: string): ResultadoParse {
  const blocos = conteudo.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi);

  if (!blocos || blocos.length === 0) {
    throw new ExtratoInvalidoError('O arquivo OFX não contém lançamentos (STMTTRN).');
  }

  const resultado: LinhaExtrato[] = [];
  const ignoradas: ResultadoParse['ignoradas'] = [];

  blocos.forEach((bloco, i) => {
    const data = normalizarData(campoOFX(bloco, 'DTPOSTED') ?? '');
    const valorBruto = normalizarValor(campoOFX(bloco, 'TRNAMT') ?? '');
    // MEMO é o texto do extrato; NAME é o nome do estabelecimento. Um dos dois serve.
    const descricao = campoOFX(bloco, 'MEMO') ?? campoOFX(bloco, 'NAME') ?? '';
    const idExterno = campoOFX(bloco, 'FITID') ?? undefined;

    if (!data) {
      ignoradas.push({ linha: i + 1, conteudo: bloco.slice(0, 120), motivo: 'data inválida' });
      return;
    }
    if (!descricao.trim()) {
      ignoradas.push({ linha: i + 1, conteudo: bloco.slice(0, 120), motivo: 'descrição vazia' });
      return;
    }
    if (valorBruto === null || valorBruto === 0) {
      ignoradas.push({ linha: i + 1, conteudo: bloco.slice(0, 120), motivo: 'valor inválido ou zero' });
      return;
    }

    resultado.push({
      data,
      descricao: descricao.trim(),
      valor: Math.abs(valorBruto),
      tipo: valorBruto < 0 ? 'SAIDA' : 'ENTRADA',
      ...(idExterno ? { idExterno } : {}),
    });
  });

  if (resultado.length === 0) {
    throw new ExtratoInvalidoError('Nenhum lançamento válido foi encontrado no arquivo OFX.');
  }

  return { linhas: resultado, ignoradas, formato: 'OFX' };
}

// ──────────────────────────────────────────────────────────── entrada única

/** Escolhe o parser pelo conteúdo, não pela extensão — que o usuário pode trocar. */
export function parseExtrato(conteudo: string, nomeArquivo = ''): ResultadoParse {
  const pareceOFX = /<OFX>|<STMTTRN>/i.test(conteudo);
  if (pareceOFX) return parseOFX(conteudo);

  if (/\.ofx$/i.test(nomeArquivo)) {
    throw new ExtratoInvalidoError(
      'O arquivo tem extensão .ofx mas não parece um extrato OFX válido.',
    );
  }
  return parseCSV(conteudo);
}
