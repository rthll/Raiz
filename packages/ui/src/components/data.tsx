import { donutSlices, OVER_BUDGET_COLOR } from '@raiz/core';
import type { ReactNode } from 'react';

/** Bolinha colorida de categoria ou classe de ativo. */
export function Dot({ cor, tamanho = 10 }: { cor: string; tamanho?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: tamanho,
        height: tamanho,
        borderRadius: 999,
        background: cor,
        flex: 'none',
        display: 'inline-block',
      }}
    />
  );
}

export interface BarProps {
  /** Percentual 0–100+. Acima de 100 a barra enche, mas o valor segue informado. */
  pct: number;
  cor: string;
  altura?: number;
  /** Pinta de `#8c491a` quando passa de 100%, como o design pede. */
  estourou?: boolean;
  /** Descrição para leitor de tela. Sem isto a barra é invisível para quem não vê. */
  aria?: string;
}

/** Barra de progresso: trilha neutra + preenchimento proporcional. */
export function Bar({ pct, cor, altura = 8, estourou, aria }: BarProps) {
  const largura = Math.max(2, Math.min(100, pct));
  return (
    <div
      role={aria ? 'progressbar' : undefined}
      aria-label={aria}
      aria-valuenow={aria ? Math.round(pct) : undefined}
      aria-valuemin={aria ? 0 : undefined}
      aria-valuemax={aria ? 100 : undefined}
      style={{
        background: 'var(--color-neutral-200)',
        borderRadius: 999,
        height: altura,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${largura}%`,
          height: '100%',
          borderRadius: 999,
          background: estourou ? OVER_BUDGET_COLOR : cor,
        }}
      />
    </div>
  );
}

/** Monograma circular: a inicial do nome. Contas, assinaturas e vencimentos. */
export function Monogram({
  texto,
  tamanho = 38,
  fundo = 'var(--color-accent-200)',
  cor = 'var(--color-accent-900)',
}: {
  texto: string;
  tamanho?: number;
  fundo?: string;
  cor?: string;
}) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: tamanho,
        height: tamanho,
        borderRadius: 999,
        flex: 'none',
        display: 'grid',
        placeItems: 'center',
        fontFamily: 'var(--font-heading)',
        fontSize: Math.round(tamanho * 0.42),
        background: fundo,
        color: cor,
      }}
    >
      {texto}
    </span>
  );
}

export interface DonutProps {
  fatias: ReadonlyArray<{ classe: string; valor: number }>;
  tamanho?: number;
  /** Conteúdo do furo central — normalmente "Investido" + total. */
  centro?: ReactNode;
}

/**
 * Donut de alocação: um `conic-gradient` com um furo por cima.
 *
 * É como o protótipo faz, e é a escolha certa aqui — nenhuma biblioteca de
 * gráficos, nenhum SVG, e as cores saem direto de `@raiz/core`.
 */
export function Donut({ fatias, tamanho = 164, centro }: DonutProps) {
  const partes = donutSlices(fatias);
  const gradiente =
    partes.length > 0
      ? `conic-gradient(${partes.map((f) => f.stop).join(',')})`
      : 'var(--color-neutral-200)';

  return (
    <div
      style={{
        position: 'relative',
        width: tamanho,
        height: tamanho,
        borderRadius: 999,
        flex: 'none',
        background: gradiente,
      }}
    >
      {centro && (
        <div
          style={{
            position: 'absolute',
            inset: Math.round(tamanho * 0.16),
            borderRadius: 999,
            background: 'var(--color-surface)',
            display: 'grid',
            placeItems: 'center',
            textAlign: 'center',
            padding: 8,
          }}
        >
          {centro}
        </div>
      )}
    </div>
  );
}

export interface ColunaFluxo {
  rotulo: string;
  entradas: number;
  saidas: number;
  /** Meses futuros aparecem esmaecidos e com rótulo em itálico. */
  previsto?: boolean;
}

/** Gráfico de barras de entradas e saídas por mês. */
export function FluxoChart({
  colunas,
  altura = 176,
}: {
  colunas: readonly ColunaFluxo[];
  altura?: number;
}) {
  const maximo = Math.max(1, ...colunas.flatMap((c) => [c.entradas, c.saidas]));

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 'var(--space-3)',
          height: altura,
          overflowX: 'auto',
        }}
      >
        {colunas.map((coluna) => (
          <div
            key={coluna.rotulo}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              flex: '1 1 0',
              minWidth: 44,
              height: '100%',
            }}
          >
            <div
              style={{
                display: 'flex',
                gap: 4,
                alignItems: 'flex-end',
                height: '100%',
                opacity: coluna.previsto ? 0.45 : 1,
              }}
            >
              <div
                title={`Entradas em ${coluna.rotulo}`}
                style={{
                  width: 18,
                  height: `${Math.max(4, (coluna.entradas / maximo) * 100)}%`,
                  borderRadius: '999px 999px 4px 4px',
                  background: 'var(--color-accent-2-500)',
                }}
              />
              <div
                title={`Saídas em ${coluna.rotulo}`}
                style={{
                  width: 18,
                  height: `${Math.max(4, (coluna.saidas / maximo) * 100)}%`,
                  borderRadius: '999px 999px 4px 4px',
                  background: 'var(--color-accent-500)',
                }}
              />
            </div>
            <div
              style={{
                fontSize: 11,
                whiteSpace: 'nowrap',
                color: coluna.previsto ? 'var(--color-neutral-600)' : 'var(--color-neutral-800)',
                fontStyle: coluna.previsto ? 'italic' : 'normal',
              }}
            >
              {coluna.rotulo}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-4)', marginTop: 'var(--space-3)' }}>
        <Legenda cor="var(--color-accent-2-500)" rotulo="Entradas" />
        <Legenda cor="var(--color-accent-500)" rotulo="Saídas" />
      </div>
    </div>
  );
}

function Legenda({ cor, rotulo }: { cor: string; rotulo: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
      <Dot cor={cor} />
      {rotulo}
    </span>
  );
}
