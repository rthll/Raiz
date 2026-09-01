import type { ReactNode } from 'react';
import { Button } from './Button.js';
import { Card, CardBody, CardTitle } from './Card.js';
import { Dialog } from './Dialog.js';

/**
 * Os estados que o protótipo não desenhou e o handoff pede explicitamente:
 * vazio, carregando, erro e confirmação antes de excluir.
 */

/** Bloco cinza pulsante no lugar de um conteúdo que ainda está carregando. */
export function Skeleton({
  altura = 16,
  largura = '100%',
  raio = 999,
}: {
  altura?: number | string;
  largura?: number | string;
  raio?: number | string;
}) {
  return (
    <span
      aria-hidden="true"
      className="raiz-skeleton"
      style={{ display: 'block', height: altura, width: largura, borderRadius: raio }}
    />
  );
}

/** Card inteiro em esqueleto — usado enquanto os KPIs carregam. */
export function SkeletonCard({ linhas = 3 }: { linhas?: number }) {
  return (
    <Card aria-busy="true">
      <Skeleton altura={12} largura="45%" />
      <Skeleton altura={27} largura="70%" raio={8} />
      {Array.from({ length: Math.max(0, linhas - 2) }, (_, i) => (
        <Skeleton key={i} altura={12} largura="60%" />
      ))}
    </Card>
  );
}

export interface EmptyStateProps {
  titulo: string;
  descricao: string;
  acao?: ReactNode;
}

/** Nada para mostrar — e um caminho para sair desse estado. */
export function EmptyState({ titulo, descricao, acao }: EmptyStateProps) {
  return (
    <Card style={{ textAlign: 'center', padding: 'var(--space-8) var(--space-4)' }}>
      <CardTitle>{titulo}</CardTitle>
      <CardBody style={{ flex: 'none' }}>{descricao}</CardBody>
      {acao && <div style={{ marginTop: 'var(--space-2)' }}>{acao}</div>}
    </Card>
  );
}

export interface ErrorStateProps {
  titulo?: string;
  descricao?: string;
  onTentarNovamente?: () => void;
}

export function ErrorState({
  titulo = 'Não foi possível carregar',
  descricao = 'Verifique sua conexão e tente de novo.',
  onTentarNovamente,
}: ErrorStateProps) {
  return (
    <Card
      role="alert"
      fundo="var(--color-accent-200)"
      style={{ textAlign: 'center', padding: 'var(--space-6) var(--space-4)' }}
    >
      <CardTitle style={{ color: 'var(--color-accent-900)' }}>{titulo}</CardTitle>
      <CardBody style={{ flex: 'none', color: 'var(--color-accent-900)' }}>{descricao}</CardBody>
      {onTentarNovamente && (
        <div style={{ marginTop: 'var(--space-2)' }}>
          <Button variant="primary" onClick={onTentarNovamente}>
            Tentar novamente
          </Button>
        </div>
      )}
    </Card>
  );
}

export interface ConfirmDialogProps {
  aberto: boolean;
  titulo: string;
  descricao: string;
  /** Texto do botão que confirma. Diga o que vai acontecer: "Excluir cartão". */
  rotuloConfirmar: string;
  onConfirmar: () => void;
  onCancelar: () => void;
  carregando?: boolean;
}

/**
 * Confirmação antes de uma ação destrutiva.
 *
 * "Cancelar" vem primeiro e é o destino inicial do foco, então Enter logo após
 * abrir cancela em vez de excluir.
 */
export function ConfirmDialog({
  aberto,
  titulo,
  descricao,
  rotuloConfirmar,
  onConfirmar,
  onCancelar,
  carregando,
}: ConfirmDialogProps) {
  return (
    <Dialog
      aberto={aberto}
      titulo={titulo}
      onFechar={onCancelar}
      largura={420}
      acoes={
        <>
          <Button variant="secondary" onClick={onCancelar} disabled={carregando}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={onConfirmar} disabled={carregando}>
            {carregando ? 'Excluindo…' : rotuloConfirmar}
          </Button>
        </>
      }
    >
      <div className="dialog-body">{descricao}</div>
    </Dialog>
  );
}
