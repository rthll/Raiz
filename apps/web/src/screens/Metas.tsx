import { formatBRL, formatPercent, GOAL_REACHED_COLOR } from '@raiz/core';
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
import { useMetas, useOrcamentos } from '../api/hooks.js';
import type { Meta } from '../api/types.js';
import { MetaDialog } from '../dialogs/MetaDialog.js';
import { useCrud } from '../dialogs/useCrud.js';
import { useCompetencia } from '../state/competencia.js';
import { TelaHeader } from '../shell/TelaHeader.js';

export function Metas() {
  const { mes } = useCompetencia();
  const metas = useMetas();
  const orcamentos = useOrcamentos(mes);

  const crud = useCrud<Meta>('goals', { singular: 'Meta', artigo: 'a' });

  const acumulado = metas.data?.reduce((a, m) => a + m.atual, 0) ?? 0;
  const alvoTotal = metas.data?.reduce((a, m) => a + m.alvo, 0) ?? 0;

  return (
    <>
      <TelaHeader
        acoes={
          <Button variant="primary" onClick={crud.abrirNovo}>
            Nova meta
          </Button>
        }
      />

      {metas.data && metas.data.length > 0 && (
        <CardMeta style={{ marginBottom: 'var(--space-3)' }}>
          {metas.data.length} metas ativas · {formatBRL(acumulado, { decimals: 0 })} de{' '}
          {formatBRL(alvoTotal, { decimals: 0 })} acumulados
        </CardMeta>
      )}

      {metas.isError && <ErrorState onTentarNovamente={() => void metas.refetch()} />}

      {metas.isPending && (
        <div className="raiz-grid raiz-grid-card">
          {Array.from({ length: 4 }, (_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {metas.data?.length === 0 && (
        <EmptyState
          titulo="Nenhuma meta definida"
          descricao="Metas mostram quanto guardar por mês para chegar onde você quer."
          acao={
            <Button variant="primary" onClick={crud.abrirNovo}>
              Nova meta
            </Button>
          }
        />
      )}

      {metas.data && metas.data.length > 0 && (
        <div className="raiz-grid raiz-grid-card" style={{ marginBottom: 'var(--space-3)' }}>
          {metas.data.map((meta) => (
            <Card key={meta.id}>
              <div className="raiz-row">
                <CardTitle>{meta.nome}</CardTitle>
                <div className="raiz-push">
                  <ChipPercentual pct={formatPercent(meta.progresso)} />
                </div>
              </div>

              <Bar
                pct={meta.progresso}
                cor={meta.atingida ? GOAL_REACHED_COLOR : 'var(--color-accent)'}
                altura={10}
                aria={`${meta.nome}: ${formatPercent(meta.progresso)} do alvo`}
              />

              <CardMeta>
                <Money valor={meta.atual} decimals={0} /> de{' '}
                <Money valor={meta.alvo} decimals={0} />
              </CardMeta>

              <div style={{ fontSize: 13 }}>
                {meta.atingida ? (
                  'Meta atingida.'
                ) : (
                  <>
                    Guardar {formatBRL(meta.guardarPorMes, { decimals: 0 })} por mês para chegar em{' '}
                    {meta.prazoMeses} meses
                  </>
                )}
              </div>

              <div className="raiz-row">
                <Button variant="secondary" onClick={() => crud.abrirEdicao(meta)}>
                  Editar
                </Button>
                <Button
                  variant="ghost"
                  style={{ color: 'var(--color-neutral-700)' }}
                  onClick={() => crud.pedirExclusao(meta)}
                >
                  Excluir
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {orcamentos.data && orcamentos.data.itens.length > 0 && (
        <Card>
          <CardKicker>Orçamento do mês por categoria</CardKicker>
          {orcamentos.data.estourados > 0 && (
            <CardMeta>
              {orcamentos.data.estourados} categoria
              {orcamentos.data.estourados === 1 ? '' : 's'} acima do limite.
            </CardMeta>
          )}
          <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
            {orcamentos.data.itens.map((item) => (
              <div className="raiz-row" key={item.categoria.id} style={{ gap: 'var(--space-3)' }}>
                <span
                  className="raiz-row"
                  style={{ minWidth: 150, flex: 'none', flexWrap: 'nowrap' }}
                >
                  <Dot cor={item.categoria.cor} />
                  <span style={{ fontSize: 14 }}>{item.categoria.nome}</span>
                </span>
                <div style={{ flex: '1 1 120px', minWidth: 100 }}>
                  <Bar
                    pct={item.pct}
                    cor={item.categoria.cor}
                    altura={9}
                    estourou={item.estourou}
                    aria={`${item.categoria.nome}: ${formatPercent(item.pct)} do orçamento`}
                  />
                </div>
                <span
                  style={{
                    minWidth: 150,
                    textAlign: 'right',
                    fontSize: 12,
                    color: item.estourou ? 'var(--color-accent-700)' : undefined,
                  }}
                >
                  {formatBRL(item.gasto, { decimals: 0 })} de{' '}
                  {formatBRL(item.limite, { decimals: 0 })} · {formatPercent(item.pct)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <MetaDialog aberto={crud.dialogoAberto} editando={crud.editando} onFechar={crud.fechar} />
      {crud.confirmacao}
    </>
  );
}
