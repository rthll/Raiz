import { formatBRL } from '@raiz/core';
import {
  Button,
  Table,
  Tag,
  TdNumero,
  ThNumero,
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
import { useContas, useImportacoes } from '../api/hooks.js';
import type { Conta, TipoConta } from '../api/types.js';
import { ContaDialog } from '../dialogs/ContaDialog.js';
import { ImportarDialog } from '../dialogs/ImportarDialog.js';
import { useCrud } from '../dialogs/useCrud.js';
import { TelaHeader } from '../shell/TelaHeader.js';
import { useState } from 'react';

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

/**  +  → . */
/** `2026-08-01` + `2026-08-28` → `01–28/08`; meses diferentes mostram os dois. */
function periodo(inicio: string, fim: string): string {
  const dia = (iso: string) => iso.slice(8, 10);
  const mes = (iso: string) => iso.slice(5, 7);
  return mes(inicio) === mes(fim)
    ? `${dia(inicio)}–${dia(fim)}/${mes(fim)}`
    : `${dia(inicio)}/${mes(inicio)}–${dia(fim)}/${mes(fim)}`;
}

export function Contas() {
  const contas = useContas();
  const importacoes = useImportacoes();
  const [importando, setImportando] = useState(false);

  const crud = useCrud<Conta>('accounts', { singular: 'Conta', artigo: 'a' });

  const saldoTotal = contas.data?.reduce((a, c) => a + c.saldo, 0) ?? 0;

  return (
    <>
      <TelaHeader
        semMes
        acoes={
          <>
            <Button variant="secondary" onClick={() => setImportando(true)}>
              Importar CSV/OFX
            </Button>
            <Button variant="primary" onClick={crud.abrirNovo}>
              Nova conta
            </Button>
          </>
        }
      />

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
          acao={
            <Button variant="primary" onClick={crud.abrirNovo}>
              Nova conta
            </Button>
          }
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
                <Button variant="secondary" onClick={() => crud.abrirEdicao(conta)}>
                  Editar
                </Button>
                <Button
                  variant="ghost"
                  style={{ color: 'var(--color-neutral-700)' }}
                  onClick={() => crud.pedirExclusao(conta)}
                >
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
            onClick={() => setImportando(true)}
          >
            <CardKicker>Importar extrato</CardKicker>
            <span style={{ fontSize: 14 }}>Arraste um arquivo CSV ou OFX</span>
            <CardMeta>até 5 MB · CSV ou OFX</CardMeta>
          </button>
        </div>
      )}

      {importacoes.data && importacoes.data.length > 0 && (
        <Card style={{ marginTop: 'var(--space-3)' }}>
          <CardKicker>Últimas importações</CardKicker>
          <Table aria="Histórico de importações">
            <thead>
              <tr>
                <th scope="col">Arquivo</th>
                <th scope="col">Conta</th>
                <th scope="col">Período</th>
                <ThNumero>Lançamentos</ThNumero>
                <th scope="col">Classificados</th>
              </tr>
            </thead>
            <tbody>
              {importacoes.data.map((imp) => (
                <tr key={imp.id}>
                  <td>{imp.arquivo}</td>
                  <td>{contas.data?.find((c) => c.id === imp.accountId)?.nome ?? '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {periodo(imp.periodoInicio, imp.periodoFim)}
                  </td>
                  <TdNumero>{imp.quantidade}</TdNumero>
                  <td>
                    <Tag variant="accent-2">{imp.classificados} classificados</Tag>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      <ImportarDialog aberto={importando} onFechar={() => setImportando(false)} />
      <ContaDialog aberto={crud.dialogoAberto} editando={crud.editando} onFechar={crud.fechar} />
      {crud.confirmacao}
    </>
  );
}
