import { Button, MonthPicker, Tag } from '@raiz/ui';
import type { ReactNode } from 'react';
import { useCompetencia } from '../state/competencia.js';

export interface TelaHeaderProps {
  /** Ações à direita do seletor de mês. */
  acoes?: ReactNode;
  /** Esconde o seletor nas telas que não têm recorte mensal. */
  semMes?: boolean;
}

/**
 * A faixa de ações que aparece abaixo do título em todas as telas:
 * seletor de mês + botões. O título em si fica no `AppShell`, que já sabe qual
 * tela está aberta pela rota.
 */
export function TelaHeader({ acoes, semMes }: TelaHeaderProps) {
  const { mes, setMes, minimo, maximo } = useCompetencia();

  return (
    <div className="main-acoes" style={{ marginBottom: 'var(--space-4)' }}>
      {!semMes && <MonthPicker valor={mes} onChange={setMes} minimo={minimo} maximo={maximo} />}
      {acoes}
    </div>
  );
}

export interface BannerAlertaProps {
  texto: string;
  onRevisar?: () => void;
}

/** Banner de atenção do topo: teste grátis vencendo, fatura fechando. */
export function BannerAlerta({ texto, onRevisar }: BannerAlertaProps) {
  return (
    <div
      role="status"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 'var(--space-2)',
        background: 'var(--color-accent-200)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-3) var(--space-4)',
        marginBottom: 'var(--space-4)',
      }}
    >
      <Tag style={{ background: 'var(--color-accent)', color: 'var(--color-bg)' }}>Atenção</Tag>
      <span style={{ fontSize: 13, color: 'var(--color-accent-900)', flex: '1 1 260px' }}>
        {texto}
      </span>
      {onRevisar && (
        <Button variant="ghost" onClick={onRevisar} style={{ marginLeft: 'auto' }}>
          Revisar
        </Button>
      )}
    </div>
  );
}
