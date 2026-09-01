import { useId } from 'react';

export interface SegmentedOption<T extends string> {
  valor: T;
  rotulo: string;
}

export interface SegmentedProps<T extends string> {
  /** Rótulo do grupo para leitores de tela. Não aparece na tela. */
  aria: string;
  opcoes: ReadonlyArray<SegmentedOption<T>>;
  valor: T;
  onChange: (valor: T) => void;
  name?: string;
}

/**
 * Controle segmentado do Organic (`.seg` / `.seg-opt`).
 *
 * Construído sobre `<input type="radio">` de verdade, como o design system faz:
 * a seleção vem do `:checked` no CSS, e as setas do teclado navegam entre as
 * opções sem uma linha de JavaScript. Uma versão com `<button>` perderia isso.
 */
export function Segmented<T extends string>({
  aria,
  opcoes,
  valor,
  onChange,
  name,
}: SegmentedProps<T>) {
  const gerado = useId();
  const grupo = name ?? gerado;

  return (
    <div className="seg" role="radiogroup" aria-label={aria}>
      {opcoes.map((opcao) => (
        <label key={opcao.valor} className="seg-opt">
          <input
            type="radio"
            name={grupo}
            value={opcao.valor}
            checked={valor === opcao.valor}
            onChange={() => onChange(opcao.valor)}
          />
          {opcao.rotulo}
        </label>
      ))}
    </div>
  );
}
