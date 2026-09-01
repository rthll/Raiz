import { formatBRL } from '@raiz/core';
import {
  Button,
  Card,
  CardMeta,
  Dialog,
  Dot,
  Field,
  Money,
  Select,
  Table,
  Tag,
  TdNumero,
  ThNumero,
} from '@raiz/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState, type DragEvent } from 'react';
import { ApiError } from '../api/client.js';
import { useCategorias, useContas } from '../api/hooks.js';
import { useAvisos } from '../ui/Toaster.js';

const TAMANHO_MAXIMO = 5 * 1024 * 1024;
const EXTENSOES = ['.csv', '.ofx', '.txt'];

interface LinhaPrevia {
  data: string;
  descricao: string;
  valor: number;
  tipo: 'ENTRADA' | 'SAIDA';
  fingerprint: string;
  duplicada: boolean;
  categoriaId: string | null;
  categoriaNome: string | null;
  regraTermo: string | null;
}

interface Previa {
  arquivo: string;
  accountId: string;
  linhas: LinhaPrevia[];
  total: number;
  duplicadas: number;
  classificadas: number;
  ignoradas: Array<{ linha: number; conteudo: string; motivo: string }>;
  formato: 'CSV' | 'OFX';
  periodo: { inicio: string; fim: string };
}

const diaMes = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export function ImportarDialog({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const contas = useContas();
  const categorias = useCategorias();
  const qc = useQueryClient();
  const { mostrar } = useAvisos();
  const inputArquivo = useRef<HTMLInputElement>(null);

  const [accountId, setAccountId] = useState('');
  const [categoriaPadraoId, setCategoriaPadraoId] = useState('');
  const [aplicarRegras, setAplicarRegras] = useState(true);
  const [ignorarDuplicados, setIgnorarDuplicados] = useState(true);
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [arrastando, setArrastando] = useState(false);

  const limpar = useCallback(() => {
    setPrevia(null);
    setErro(null);
    setArrastando(false);
  }, []);

  const fechar = () => {
    limpar();
    setAccountId('');
    onFechar();
  };

  /** Valida no cliente antes de subir: erro imediato é melhor que ida e volta. */
  const validarArquivo = (arquivo: File): string | null => {
    const extensaoOk = EXTENSOES.some((ext) => arquivo.name.toLowerCase().endsWith(ext));
    if (!extensaoOk) return 'Envie um arquivo .csv ou .ofx.';
    if (arquivo.size > TAMANHO_MAXIMO) {
      return `O arquivo tem ${(arquivo.size / 1024 / 1024).toFixed(1)} MB e o limite é 5 MB.`;
    }
    if (arquivo.size === 0) return 'O arquivo está vazio.';
    return null;
  };

  const enviarParaPrevia = async (arquivo: File) => {
    setErro(null);

    if (!accountId) {
      setErro('Escolha a conta de destino antes de enviar o arquivo.');
      return;
    }
    const problema = validarArquivo(arquivo);
    if (problema) {
      setErro(problema);
      return;
    }

    setOcupado(true);
    try {
      const corpo = new FormData();
      // O campo vem antes do arquivo: o parser multipart lê em ordem.
      corpo.append('accountId', accountId);
      corpo.append('arquivo', arquivo);

      const res = await fetch('/api/imports/preview', {
        method: 'POST',
        credentials: 'include',
        body: corpo,
      });
      const dados = await res.json();

      if (!res.ok) {
        throw new ApiError(res.status, dados.error ?? 'erro', dados.message ?? 'Falha ao ler.');
      }
      setPrevia(dados as Previa);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível ler o arquivo.');
    } finally {
      setOcupado(false);
    }
  };

  const confirmar = async () => {
    if (!previa) return;
    if (!categoriaPadraoId) {
      setErro('Escolha a categoria para os lançamentos que nenhuma regra classificar.');
      return;
    }

    setOcupado(true);
    setErro(null);
    try {
      const res = await fetch('/api/imports/confirm', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: previa.accountId,
          arquivo: previa.arquivo,
          linhas: previa.linhas,
          aplicarRegras,
          ignorarDuplicados,
          categoriaPadraoId,
        }),
      });
      const dados = await res.json();
      if (!res.ok) {
        throw new ApiError(res.status, dados.error ?? 'erro', dados.message ?? 'Falha ao importar.');
      }

      mostrar(
        dados.criados === 0
          ? 'Nada novo para importar — tudo já estava lançado.'
          : `${dados.criados} lançamento${dados.criados === 1 ? '' : 's'} importado${dados.criados === 1 ? '' : 's'}.`,
      );
      // Um extrato inteiro mexe em quase toda tela.
      void qc.invalidateQueries();
      fechar();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível importar.');
    } finally {
      setOcupado(false);
    }
  };

  const onDrop = (evento: DragEvent) => {
    evento.preventDefault();
    setArrastando(false);
    const arquivo = evento.dataTransfer.files[0];
    if (arquivo) void enviarParaPrevia(arquivo);
  };

  const aImportar = previa
    ? ignorarDuplicados
      ? previa.total - previa.duplicadas
      : previa.total
    : 0;

  return (
    <Dialog
      aberto={aberto}
      titulo="Importar extrato"
      onFechar={fechar}
      largura={previa ? 720 : 540}
      acoes={
        <>
          <Button variant="secondary" onClick={previa ? limpar : fechar} disabled={ocupado}>
            {previa ? 'Escolher outro arquivo' : 'Cancelar'}
          </Button>
          {previa && (
            <Button
              variant="primary"
              onClick={() => void confirmar()}
              disabled={ocupado || aImportar === 0}
            >
              {ocupado
                ? 'Importando…'
                : aImportar === 0
                  ? 'Nada para importar'
                  : `Importar ${aImportar} lançamento${aImportar === 1 ? '' : 's'}`}
            </Button>
          )}
        </>
      }
    >
      <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
        <Field label="Conta de destino">
          {(p) => (
            <Select
              {...p}
              value={accountId}
              onChange={(e) => {
                setAccountId(e.target.value);
                limpar();
              }}
              disabled={!!previa}
            >
              <option value="">Selecione…</option>
              {contas.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Select>
          )}
        </Field>

        {!previa && (
          <>
            <input
              ref={inputArquivo}
              type="file"
              accept=".csv,.ofx,.txt"
              className="raiz-sr-only"
              onChange={(e) => {
                const arquivo = e.target.files?.[0];
                if (arquivo) void enviarParaPrevia(arquivo);
                // Permite reenviar o mesmo arquivo depois de um erro.
                e.target.value = '';
              }}
            />
            <button
              type="button"
              className="raiz-dropzone"
              data-arrastando={arrastando || undefined}
              onClick={() => inputArquivo.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setArrastando(true);
              }}
              onDragLeave={() => setArrastando(false)}
              onDrop={onDrop}
              disabled={ocupado}
            >
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: 17 }}>
                {ocupado ? 'Lendo o arquivo…' : 'Arraste o extrato aqui'}
              </span>
              <CardMeta>ou clique para escolher · CSV ou OFX até 5 MB</CardMeta>
            </button>
          </>
        )}

        {erro && (
          <div
            role="alert"
            style={{
              fontSize: 13,
              padding: 'var(--space-2) var(--space-3)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-accent-200)',
              color: 'var(--color-accent-900)',
            }}
          >
            {erro}
          </div>
        )}

        {previa && (
          <>
            <Card fundo="var(--color-accent-2-200)">
              <div style={{ fontSize: 13 }}>
                <strong>{previa.arquivo}</strong> · {previa.formato} · {previa.total} lançamentos de{' '}
                {diaMes(previa.periodo.inicio)} a {diaMes(previa.periodo.fim)}
              </div>
              <CardMeta>
                {previa.classificadas} classificados por regra · {previa.duplicadas} já existem
                {previa.ignoradas.length > 0 &&
                  ` · ${previa.ignoradas.length} linha${previa.ignoradas.length === 1 ? '' : 's'} ilegível${previa.ignoradas.length === 1 ? '' : 'is'}`}
              </CardMeta>
            </Card>

            <div className="raiz-form-grid">
              <Field label="Categoria padrão" dica="Para quem nenhuma regra classificar">
                {(p) => (
                  <Select
                    {...p}
                    value={categoriaPadraoId}
                    onChange={(e) => setCategoriaPadraoId(e.target.value)}
                  >
                    <option value="">Selecione…</option>
                    {categorias.data
                      ?.filter((c) => c.tipo === 'SAIDA')
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome}
                        </option>
                      ))}
                  </Select>
                )}
              </Field>

              <div style={{ display: 'grid', gap: 8, alignContent: 'center' }}>
                <label className="raiz-row" style={{ fontSize: 14, gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={aplicarRegras}
                    onChange={(e) => setAplicarRegras(e.target.checked)}
                  />
                  Aplicar regras automáticas
                </label>
                <label className="raiz-row" style={{ fontSize: 14, gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={ignorarDuplicados}
                    onChange={(e) => setIgnorarDuplicados(e.target.checked)}
                  />
                  Ignorar duplicados
                </label>
              </div>
            </div>

            <div style={{ maxHeight: 280, overflowY: 'auto' }}>
              <Table aria="Prévia dos lançamentos a importar">
                <thead>
                  <tr>
                    <th scope="col">Data</th>
                    <th scope="col">Descrição</th>
                    <th scope="col">Categoria</th>
                    <ThNumero>Valor</ThNumero>
                  </tr>
                </thead>
                <tbody>
                  {previa.linhas.map((linha) => (
                    <tr
                      key={linha.fingerprint}
                      style={{ opacity: linha.duplicada && ignorarDuplicados ? 0.45 : 1 }}
                    >
                      <td style={{ whiteSpace: 'nowrap' }}>{diaMes(linha.data)}</td>
                      <td>
                        <span className="raiz-row">
                          {linha.descricao}
                          {linha.duplicada && <Tag variant="neutral">já existe</Tag>}
                        </span>
                      </td>
                      <td>
                        {linha.categoriaNome && aplicarRegras ? (
                          <span className="raiz-row">
                            <Dot cor={
                              categorias.data?.find((c) => c.id === linha.categoriaId)?.cor ??
                              'var(--color-neutral-500)'
                            } />
                            {linha.categoriaNome}
                          </span>
                        ) : (
                          <CardMeta>padrão</CardMeta>
                        )}
                      </td>
                      <TdNumero
                        style={{
                          fontWeight: 600,
                          color:
                            linha.tipo === 'ENTRADA' ? 'var(--color-accent-2-700)' : undefined,
                        }}
                      >
                        <Money valor={linha.valor} sinal={linha.tipo} />
                      </TdNumero>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>

            {previa.ignoradas.length > 0 && (
              <details style={{ fontSize: 12 }}>
                <summary style={{ cursor: 'pointer' }}>
                  {previa.ignoradas.length} linha
                  {previa.ignoradas.length === 1 ? '' : 's'} que não deu para ler
                </summary>
                <ul style={{ margin: 'var(--space-2) 0 0', paddingLeft: 'var(--space-4)' }}>
                  {previa.ignoradas.slice(0, 10).map((i) => (
                    <li key={i.linha}>
                      Linha {i.linha}: {i.motivo}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <CardMeta>
              Total a importar: {formatBRL(
                previa.linhas
                  .filter((l) => !(l.duplicada && ignorarDuplicados))
                  .reduce((a, l) => a + (l.tipo === 'SAIDA' ? -l.valor : l.valor), 0),
              )}
            </CardMeta>
          </>
        )}
      </div>
    </Dialog>
  );
}
