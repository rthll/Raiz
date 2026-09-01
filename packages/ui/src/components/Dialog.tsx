import { useCallback, useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const FOCAVEIS =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Um elemento oculto não deve entrar no ciclo do Tab.
 *
 * `checkVisibility()` é a API padrão para essa pergunta. Onde ela não existe,
 * o padrão é **incluir** o elemento: um trap que deixa passar um campo invisível
 * é um incômodo; um trap que descarta todos os campos não prende nada, que é o
 * bug que `offsetParent` causava aqui.
 */
function visivel(el: HTMLElement): boolean {
  return typeof el.checkVisibility === 'function' ? el.checkVisibility() : true;
}

export interface DialogProps {
  aberto: boolean;
  titulo: string;
  onFechar: () => void;
  /** Rodapé (`.dialog-actions`): Cancelar + CTA primário. */
  acoes?: ReactNode;
  children: ReactNode;
  /** O handoff pede 540px para os diálogos deste app; o Organic traz 440. */
  largura?: number;
}

/**
 * Modal do Organic com o comportamento que o CSS sozinho não dá.
 *
 * Um diálogo sem isto é uma armadilha de acessibilidade: quem navega por teclado
 * continua tabulando para os controles atrás do backdrop, sem ver onde está.
 * Então tratamos:
 *
 * - foco entra no diálogo ao abrir e **volta para quem o abriu** ao fechar;
 * - Tab circula dentro do diálogo (foco preso);
 * - Esc fecha;
 * - clique no backdrop fecha, mas arrastar de dentro para fora não;
 * - o corpo da página para de rolar enquanto está aberto.
 */
export function Dialog({ aberto, titulo, onFechar, acoes, children, largura = 540 }: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const focoAnterior = useRef<HTMLElement | null>(null);
  const mousedownNoBackdrop = useRef(false);
  const tituloId = useId();

  useEffect(() => {
    if (!aberto) return;

    focoAnterior.current = document.activeElement as HTMLElement | null;

    // O primeiro campo é o destino natural; sem campos, o próprio diálogo.
    const alvo = dialogRef.current?.querySelector<HTMLElement>(FOCAVEIS) ?? dialogRef.current;
    alvo?.focus();

    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = overflowAnterior;
      // Devolve o foco para o botão que abriu, senão ele volta para o topo da página.
      focoAnterior.current?.focus?.();
    };
  }, [aberto]);

  const onKeyDown = useCallback(
    (evento: React.KeyboardEvent) => {
      if (evento.key === 'Escape') {
        evento.stopPropagation();
        onFechar();
        return;
      }
      if (evento.key !== 'Tab') return;

      const focaveis = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(FOCAVEIS) ?? [],
      ).filter(visivel);
      if (focaveis.length === 0) return;

      const primeiro = focaveis[0]!;
      const ultimo = focaveis[focaveis.length - 1]!;

      if (evento.shiftKey && document.activeElement === primeiro) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primeiro.focus();
      }
    },
    [onFechar],
  );

  if (!aberto) return null;

  return createPortal(
    <div
      className="dialog-backdrop"
      onMouseDown={(e) => {
        mousedownNoBackdrop.current = e.target === e.currentTarget;
      }}
      onMouseUp={(e) => {
        // Só fecha se o gesto começou E terminou no backdrop — arrastar texto de
        // dentro do diálogo para fora não deve descartar o formulário.
        if (mousedownNoBackdrop.current && e.target === e.currentTarget) onFechar();
        mousedownNoBackdrop.current = false;
      }}
    >
      <div
        ref={dialogRef}
        className="dialog riseIn"
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        tabIndex={-1}
        style={{ width: `min(${largura}px, 100%)`, maxHeight: '90dvh', overflowY: 'auto' }}
        onKeyDown={onKeyDown}
      >
        <div className="dialog-title" id={tituloId}>
          {titulo}
        </div>
        {children}
        {acoes && <div className="dialog-actions">{acoes}</div>}
      </div>
    </div>,
    document.body,
  );
}
