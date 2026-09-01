import { formatBRL } from '@raiz/core';
import {
  Button,
  Card,
  CardKicker,
  CardMeta,
  Dot,
  EmptyState,
  ErrorState,
  Input,
  Money,
  Segmented,
  Select,
  Skeleton,
  Table,
  Tag,
  TdNumero,
  ThNumero,
} from '@raiz/ui';
import { useMemo, useState } from 'react';
import { LancamentoDialog } from '../dialogs/LancamentoDialog.js';
import { useCrud } from '../dialogs/useCrud.js';
import { useCartoes, useCategorias, useContas, useLancamentos } from '../api/hooks.js';
import type { Lancamento } from '../api/types.js';
import { usePreferencias } from '../auth/AuthProvider.js';
import { useCompetencia } from '../state/competencia.js';
import { TelaHeader } from '../shell/TelaHeader.js';

const NOME_RESPONSAVEL = { ANA: 'Ana', BRUNO: 'Bruno', CONJUNTA: 'Conjunta' } as const;

/** `2026-08-05` → `05/08`, como no protótipo. */
const diaMes = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export function Lancamentos() {
  const { mes } = useCompetencia();
  const { modoCasal } = usePreferencias();

  const [tipo, setTipo] = useState<'todos' | 'ENTRADA' | 'SAIDA'>('todos');
  const [categoriaId, setCategoriaId] = useState('');
  const [busca, setBusca] = useState('');

  const categorias = useCategorias();
  const contas = useContas();
  const cartoes = useCartoes();
  const lista = useLancamentos({ mes, tipo, categoriaId: categoriaId || undefined, q: busca || undefined });

  /** Nome da conta ou do cartão de um lançamento — a coluna "Conta/cartão". */
  const origemDe = useMemo(() => {
    const mapa = new Map<string, string>();
    contas.data?.forEach((c) => mapa.set(c.id, c.nome));
    cartoes.data?.forEach((c) => mapa.set(c.id, c.nome));
    return (l: Lancamento) => mapa.get(l.accountId ?? l.cardId ?? '') ?? '—';
  }, [contas.data, cartoes.data]);

  const categoriaDe = useMemo(() => {
    const mapa = new Map(categorias.data?.map((c) => [c.id, c]) ?? []);
    return (id: string) => mapa.get(id);
  }, [categorias.data]);

  const crud = useCrud<Lancamento>('transactions', { singular: 'Lançamento', artigo: 'o' });

  const temFiltro = tipo !== 'todos' || !!categoriaId || !!busca;
  const recorrentes = lista.data?.itens.filter((l) => l.recorrente).length ?? 0;

  return (
    <>
      <TelaHeader
        acoes={
          <Button variant="primary" onClick={crud.abrirNovo}>
            Novo lançamento
          </Button>
        }
      />

      <Card style={{ marginBottom: 'var(--space-3)' }}>
        <div className="raiz-row">
          <Segmented
            aria="Filtrar por tipo"
            valor={tipo}
            onChange={setTipo}
            opcoes={[
              { valor: 'todos', rotulo: 'Todos' },
              { valor: 'ENTRADA', rotulo: 'Entradas' },
              { valor: 'SAIDA', rotulo: 'Saídas' },
            ]}
          />
          <Select
            aria-label="Filtrar por categoria"
            value={categoriaId}
            onChange={(e) => setCategoriaId(e.target.value)}
            style={{ width: 'auto', minWidth: 160 }}
          >
            <option value="">Todas as categorias</option>
            {categorias.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
          <Input
            aria-label="Buscar por descrição"
            type="search"
            placeholder="Buscar descrição…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            style={{ flex: '1 1 180px', minWidth: 180 }}
          />
          {/* aria-live: o resumo muda a cada filtro e precisa ser anunciado. */}
          <CardMeta aria-live="polite" style={{ marginLeft: 'auto' }}>
            {lista.data
              ? `${lista.data.resumo.exibidos} de ${lista.data.resumo.total} lançamentos · saldo do mês ${formatBRL(lista.data.resumo.saldo)}`
              : '—'}
          </CardMeta>
        </div>
      </Card>

      {lista.isError && <ErrorState onTentarNovamente={() => void lista.refetch()} />}

      {lista.isPending && (
        <Card>
          <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} altura={20} />
            ))}
          </div>
        </Card>
      )}

      {lista.data && lista.data.itens.length === 0 && (
        <EmptyState
          titulo={temFiltro ? 'Nenhum lançamento com esses filtros' : 'Nenhum lançamento neste mês'}
          descricao={
            temFiltro
              ? 'Ajuste a busca, o tipo ou a categoria para ver mais resultados.'
              : 'Importe um extrato ou registre o primeiro lançamento do mês.'
          }
          acao={
            temFiltro ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setTipo('todos');
                  setCategoriaId('');
                  setBusca('');
                }}
              >
                Limpar filtros
              </Button>
            ) : (
              <Button variant="primary" onClick={crud.abrirNovo}>
                Novo lançamento
              </Button>
            )
          }
        />
      )}

      {lista.data && lista.data.itens.length > 0 && (
        <Card style={{ opacity: lista.isFetching ? 0.7 : 1 }}>
          <Table aria="Lançamentos do mês">
            <thead>
              <tr>
                <th scope="col">Data</th>
                <th scope="col">Descrição</th>
                <th scope="col">Categoria</th>
                <th scope="col">Conta/cartão</th>
                {modoCasal && <th scope="col">Responsável</th>}
                <ThNumero>Valor</ThNumero>
                <th scope="col">
                  <span className="raiz-sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {lista.data.itens.map((l) => {
                const categoria = categoriaDe(l.categoriaId);
                return (
                  <tr key={l.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{diaMes(l.data)}</td>
                    <td>
                      <span className="raiz-row">
                        {l.descricao}
                        {l.recorrente && <Tag variant="neutral">recorrente</Tag>}
                        {l.parcelaTotal && (
                          <Tag variant="neutral">
                            {l.parcelaAtual}/{l.parcelaTotal}
                          </Tag>
                        )}
                      </span>
                    </td>
                    <td>
                      <span className="raiz-row">
                        <Dot cor={categoria?.cor ?? 'var(--color-neutral-500)'} />
                        {categoria?.nome ?? '—'}
                      </span>
                    </td>
                    <td>{origemDe(l)}</td>
                    {modoCasal && <td>{NOME_RESPONSAVEL[l.responsavel]}</td>}
                    <TdNumero
                      style={{
                        fontWeight: 600,
                        color: l.tipo === 'ENTRADA' ? 'var(--color-accent-2-700)' : undefined,
                      }}
                    >
                      <Money valor={l.valor} sinal={l.tipo} />
                    </TdNumero>
                    <td>
                      <span className="raiz-row" style={{ flexWrap: 'nowrap' }}>
                        <Button variant="ghost" onClick={() => crud.abrirEdicao(l)}>
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          style={{ color: 'var(--color-neutral-700)' }}
                          onClick={() => crud.pedirExclusao(l)}
                        >
                          Excluir
                        </Button>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}

      {recorrentes > 0 && (
        <Card
          fundo="var(--color-accent-2-200)"
          style={{ marginTop: 'var(--space-3)' }}
        >
          <CardKicker>Recorrências</CardKicker>
          <div style={{ fontSize: 13 }}>
            {recorrentes} lançamento{recorrentes > 1 ? 's se repetem' : ' se repete'} sozinho
            {recorrentes > 1 ? 's' : ''} a cada mês.
          </div>
        </Card>
      )}

      <LancamentoDialog
        aberto={crud.dialogoAberto}
        editando={crud.editando}
        dataPadrao={`${mes}-01`}
        onFechar={crud.fechar}
      />
      {crud.confirmacao}
    </>
  );
}
