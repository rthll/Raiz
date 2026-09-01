import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ICON_STROKE_WIDTH } from '../tokens.js';
import { Button } from './Button.js';

const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

/** `2026-08` → `Agosto 2026`. */
export function rotuloCompetencia(competencia: string): string {
  const [ano, mes] = competencia.split('-').map(Number);
  if (!ano || !mes) return competencia;
  return `${MESES[mes - 1]} ${ano}`;
}

/** Desloca uma competência em N meses, virando o ano corretamente. */
export function deslocarCompetencia(competencia: string, meses: number): string {
  const [ano, mes] = competencia.split('-').map(Number);
  const d = new Date(Date.UTC(ano!, mes! - 1 + meses, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export interface MonthPickerProps {
  valor: string;
  onChange: (competencia: string) => void;
  /** Limites do intervalo carregado, no formato `YYYY-MM`. */
  minimo?: string;
  maximo?: string;
}

/** Seletor de mês: pílula com `‹ ›` e o rótulo por extenso. */
export function MonthPicker({ valor, onChange, minimo, maximo }: MonthPickerProps) {
  const anterior = deslocarCompetencia(valor, -1);
  const proximo = deslocarCompetencia(valor, 1);
  // Competência é ordenável como texto: `2026-08` < `2026-09`.
  const podeVoltar = !minimo || anterior >= minimo;
  const podeAvancar = !maximo || proximo <= maximo;

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        background: 'var(--color-surface)',
        borderRadius: 999,
        padding: 4,
      }}
    >
      <Button
        variant="ghost"
        icone
        aria-label="Mês anterior"
        disabled={!podeVoltar}
        onClick={() => onChange(anterior)}
      >
        <ChevronLeft size={18} strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" />
      </Button>
      {/* aria-live para o leitor de tela anunciar a troca de mês. */}
      <span
        aria-live="polite"
        style={{ fontSize: 13, minWidth: 104, textAlign: 'center' }}
      >
        {rotuloCompetencia(valor)}
      </span>
      <Button
        variant="ghost"
        icone
        aria-label="Próximo mês"
        disabled={!podeAvancar}
        onClick={() => onChange(proximo)}
      >
        <ChevronRight size={18} strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" />
      </Button>
    </div>
  );
}
