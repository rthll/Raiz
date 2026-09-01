import { formatBRL } from '@raiz/core';
import {
  Button,
  Card,
  CardKicker,
  CardMeta,
  CardTitle,
  EmptyState,
  ErrorState,
  Money,
  Monogram,
  SkeletonCard,
} from '@raiz/ui';
import { useContas } from '../api/hooks.js';
import type { TipoConta } from '../api/types.js';
import { TelaHeader } from '../shell/TelaHeader.js';

const ROTULO_TIPO: Record<TipoConta, string> = {
  CORRENTE: 'Conta corrente',
  CONJUNTA: 'Conta conjunta',
  POUPANCA: 'Poupança',
};

/** `2026-08-28T…` → "há 4 dias", relativo a hoje. */
function desde(iso: string | null): string {
  if (!iso) return 'nunca importado';
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (dias <= 0) return 'hoje';
  if (dias === 1) return 'ontem';
  if (dias < 7) return `há ${dias} dias`;
  if (dias < 14) return 'há 1 semana';
  if (dias < 30) return `há ${Math.floor(dias / 7)} semanas`;
  return `há ${Math.floor(dias / 30)} ${Math.floor(dias / 30) === 1 ? 'mês' : 'meses'}`;
}

export function Contas() {
  const contas = useContas();
  const saldoTotal = contas.data?.reduce((a, c) => a + c.saldo, 0) ?? 0;

  return (
    <>
      <TelaHeader semMes acoes={<Button variant="primary">Nova conta</Button>} />

      {contas.data && contas.data.length > 0 && (
        <CardMeta style={{ marginBottom: 'var(--space-3)' }}>
          {contas.data.length} conta{contas.data.length === 1 ? '' : 's'} ·{' '}
          {formatBRL(saldoTotal)} somados
        </CardMeta>
      )}

      {contas.isError && <ErrorState onTentarNovamente={() => void contas.refetch()} />}

      {contas.isPending && (
        <div className="raiz-grid raiz-grid-card">
          {Array.from({ length: 3 }, (_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {contas.data?.length === 0 && (
        <EmptyState
          titulo="Nenhuma conta conectada"
          descricao="Importe um extrato CSV ou OFX de cada banco para começar."
          acao={<Button variant="primary">Nova conta</Button>}
        />
      )}

      {contas.data && contas.data.length > 0 && (
        <div className="raiz-grid raiz-grid-card">
          {contas.data.map((conta) => (
            <Card key={conta.id}>
              <div className="raiz-row">
                <Monogram
                  texto={conta.nome.charAt(0)}
                  tamanho={36}
                  fundo="var(--color-accent-2-200)"
                  cor="var(--color-accent-2-900)"
                />
                <div style={{ minWidth: 0 }}>
                  <CardTitle>{conta.nome}</CardTitle>
                  <CardMeta>
                    {ROTULO_TIPO[conta.tipo]} · {conta.dono}
                  </CardMeta>
                </div>
              </div>

              <Money
                valor={conta.saldo}
                style={{ fontFamily: 'var(--font-heading)', fontSize: 24 }}
              />

              <CardMeta>último extrato importado {desde(conta.ultimaSync)}</CardMeta>

              <div className="raiz-row">
                <Button variant="secondary">Editar</Button>
                <Button variant="ghost" style={{ color: 'var(--color-neutral-700)' }}>
                  Excluir
                </Button>
              </div>
            </Card>
          ))}

          {/* Tile de importação: borda tracejada, como o handoff descreve. */}
          <button
            type="button"
            className="raiz-tile-importar"
            aria-label="Importar extrato CSV ou OFX"
          >
            <CardKicker>Importar extrato</CardKicker>
            <span style={{ fontSize: 14 }}>Arraste um arquivo CSV ou OFX</span>
            <CardMeta>até 5 MB · a Etapa 7 liga o parser</CardMeta>
          </button>
        </div>
      )}
    </>
  );
}
