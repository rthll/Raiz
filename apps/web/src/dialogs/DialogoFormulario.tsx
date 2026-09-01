import { Button, Dialog } from '@raiz/ui';
import type { ReactNode } from 'react';
import type { Formulario } from '../forms/useFormulario.js';

export interface DialogoFormularioProps {
  aberto: boolean;
  titulo: string;
  /** "Salvar" ao criar, "Salvar alterações" ao editar. */
  rotuloSalvar: string;
  formulario: Formulario<unknown>;
  onFechar: () => void;
  onSalvar: (e: React.FormEvent) => void;
  children: ReactNode;
}

/**
 * Casca comum dos diálogos de CRUD: título, grid de campos em duas colunas e o
 * rodapé Cancelar + salvar.
 *
 * O `<form>` fica **dentro** do diálogo e por fora dos campos, então Enter em
 * qualquer campo salva — comportamento nativo que um diálogo só com botões
 * perderia.
 */
export function DialogoFormulario({
  aberto,
  titulo,
  rotuloSalvar,
  formulario,
  onFechar,
  onSalvar,
  children,
}: DialogoFormularioProps) {
  return (
    <Dialog
      aberto={aberto}
      titulo={titulo}
      onFechar={onFechar}
      acoes={
        <>
          <Button variant="secondary" onClick={onFechar} disabled={formulario.enviando}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="dialogo-form"
            variant="primary"
            disabled={formulario.enviando}
          >
            {formulario.enviando ? 'Salvando…' : rotuloSalvar}
          </Button>
        </>
      }
    >
      <form id="dialogo-form" onSubmit={onSalvar} noValidate>
        <div className="raiz-form-grid">{children}</div>

        {formulario.erroGeral && (
          <div
            role="alert"
            style={{
              marginTop: 'var(--space-3)',
              fontSize: 13,
              padding: 'var(--space-2) var(--space-3)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-accent-200)',
              color: 'var(--color-accent-900)',
            }}
          >
            {formulario.erroGeral}
          </div>
        )}
      </form>
    </Dialog>
  );
}
