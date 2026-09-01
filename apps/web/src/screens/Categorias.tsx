import { formatBRL, formatPercent } from '@raiz/core';
import {
  Bar,
  Button,
  Card,
  CardKicker,
  CardMeta,
  CardTitle,
  ChipPercentual,
  Dot,
  EmptyState,
  ErrorState,
  Money,
  SkeletonCard,
} from '@raiz/ui';
import { useCategorias, useOrcamentos, useRegras } from '../api/hooks.js';
import type { Categoria } from '../api/types.js';
import { CategoriaDialog } from '../dialogs/CategoriaDialog.js';
import { useCrud } from '../dialogs/useCrud.js';
import { useCompetencia } from '../state/competencia.js';
import { TelaHeader } from '../shell/TelaHeader.js';

export function Categorias() {
  const { mes } = useCompetencia();
  const categorias = useCategorias();
  const orcamentos = useOrcamentos(mes);
  const regras = useRegras();

  const crud = useCrud<Categoria>('categories', { singular: 'Categoria', artigo: 'a' });

  const usoPorCategoria = new Map(orcamentos.data?.itens.map((i) => [i.categoria.id, i]) ?? []);

  const resumo = orcamentos.data
    ? `${categorias.data?.length ?? 0} categorias · ${formatBRL(orcamentos.data.limiteSomado, { decimals: 0 })} de limite somado, ${formatBRL(orcamentos.data.gastoSomado, { decimals: 0 })} usados`
    : null;

  return (
    <>
      <TelaHeader
        acoes={
          <Button variant="primary" onClick={crud.abrirNovo}>
            Nova categoria
          </Button>
        }
      />

      {resumo && <CardMeta style={{ marginBottom: 'var(--space-3)' }}>{resumo}</CardMeta>}

      {categorias.isError && <ErrorState onTentarNovamente={() => void categorias.refetch()} />}

      {categorias.isPending && (
        <div className="raiz-grid raiz-grid-card">
          {Array.from({ length: 6 }, (_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {categorias.data?.length === 0 && (
        <EmptyState
          titulo="Nenhuma categoria ainda"
          descricao="Categorias organizam os lançamentos e geram os alertas de orçamento."
          acao={
            <Button variant="primary" onClick={crud.abrirNovo}>
              Nova categoria
            </Button>
          }
        />
      )}

      {categorias.data && categorias.data.length > 0 && (
        <div className="raiz-grid raiz-grid-card">
          {categorias.data.map((categoria) => {
            const uso = usoPorCategoria.get(categoria.id);
            const gasto = uso?.gasto ?? 0;
            const estourou = uso?.estourou ?? false;

            return (
              <Card key={categoria.id}>
                <div className="raiz-row">
                  <Dot cor={categoria.cor} tamanho={26} />
                  <div style={{ minWidth: 0 }}>
                    <CardTitle>{categoria.nome}</CardTitle>
                    <CardMeta>
                      {categoria.tipo === 'ENTRADA' ? 'Entrada' : 'Saída'}
                      {uso ? ` · ${formatPercent(uso.pct)} do limite` : ''}
                    </CardMeta>
                  </div>
                  <div className="raiz-push">
                    {uso ? (
                      <ChipPercentual pct={formatPercent(uso.pct)} estourou={estourou} />
                    ) : (
                      <CardMeta>—</CardMeta>
                    )}
                  </div>
                </div>

                <Bar
                  pct={uso?.pct ?? 0}
                  cor={categoria.cor}
                  altura={9}
                  estourou={estourou}
                  aria={
                    uso
                      ? `${categoria.nome}: ${formatPercent(uso.pct)} do orçamento`
                      : `${categoria.nome}: sem limite definido`
                  }
                />

                <CardMeta>
                  <Money valor={gasto} /> usados
                  {categoria.orcamentoMensal != null ? (
                    <>
                      {' '}
                      / limite <Money valor={categoria.orcamentoMensal} decimals={0} />
                    </>
                  ) : (
                    ' · sem limite'
                  )}
                </CardMeta>

                <div className="raiz-row">
                  <Button variant="secondary" onClick={() => crud.abrirEdicao(categoria)}>
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    style={{ color: 'var(--color-neutral-700)' }}
                    onClick={() => crud.pedirExclusao(categoria)}
                  >
                    Excluir
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {regras.data && regras.data.length > 0 && categorias.data && (
        <Card style={{ marginTop: 'var(--space-3)' }}>
          <CardKicker>Regras de classificação automática</CardKicker>
          <CardMeta>
            Quando a descrição do extrato contém o termo, o lançamento cai na categoria.
          </CardMeta>
          <div>
            {regras.data.map((regra) => {
              const categoria = categorias.data.find((c) => c.id === regra.categoriaId);
              return (
                <div className="raiz-linha" key={regra.id}>
                  <code
                    style={{
                      background: 'var(--color-neutral-200)',
                      borderRadius: 999,
                      padding: '3px 10px',
                      fontSize: 12,
                    }}
                  >
                    {regra.termo}
                  </code>
                  <span aria-hidden="true" style={{ color: 'var(--color-neutral-600)' }}>
                    →
                  </span>
                  <span className="raiz-row">
                    <Dot cor={categoria?.cor ?? 'var(--color-neutral-500)'} />
                    <span style={{ fontSize: 14 }}>{categoria?.nome ?? '—'}</span>
                  </span>
                  <CardMeta className="raiz-push">{regra.acertos} lançamentos</CardMeta>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <CategoriaDialog
        aberto={crud.dialogoAberto}
        editando={crud.editando}
        onFechar={crud.fechar}
      />
      {crud.confirmacao}
    </>
  );
}
