import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

export interface FieldProps {
  label: string;
  /** Mensagem de erro do campo. Vem do Zod, já em pt-BR. */
  erro?: string;
  /** Ocupa as duas colunas do grid do diálogo. */
  largo?: boolean;
  dica?: string;
  children: (props: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: true }) => ReactNode;
}

/**
 * Rótulo + controle + erro.
 *
 * O filho é uma função para que o `id` gerado ligue `<label>` e controle sem que
 * quem usa precise inventar um — e para que `aria-describedby` aponte para a
 * mensagem de erro, que é o que faz o leitor de tela anunciá-la.
 */
export function Field({ label, erro, largo, dica, children }: FieldProps) {
  const id = useId();
  const idErro = `${id}-erro`;
  const idDica = `${id}-dica`;
  const describedBy = [erro ? idErro : '', dica ? idDica : ''].filter(Boolean).join(' ');

  return (
    <div className="field" style={largo ? { gridColumn: '1 / -1' } : undefined}>
      <label htmlFor={id}>{label}</label>
      {children({
        id,
        ...(describedBy ? { 'aria-describedby': describedBy } : {}),
        ...(erro ? { 'aria-invalid': true as const } : {}),
      })}
      {dica && !erro && (
        <div id={idDica} className="card-meta" style={{ marginTop: 4 }}>
          {dica}
        </div>
      )}
      {erro && (
        <div
          id={idErro}
          role="alert"
          style={{ marginTop: 4, fontSize: 11, color: 'var(--color-accent-700)' }}
        >
          {erro}
        </div>
      )}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={['input', className ?? ''].join(' ').trim()} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...props }, ref) {
    return <select ref={ref} className={['input', className ?? ''].join(' ').trim()} {...props} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea ref={ref} className={['input', className ?? ''].join(' ').trim()} {...props} />
    );
  },
);
