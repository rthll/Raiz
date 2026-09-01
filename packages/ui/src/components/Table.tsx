import type { HTMLAttributes, ReactNode, TableHTMLAttributes } from 'react';

export interface TableProps extends TableHTMLAttributes<HTMLTableElement> {
  /** Descrição da tabela para leitores de tela. */
  aria?: string;
  children: ReactNode;
}

/**
 * Tabela do Organic dentro de um contêiner que rola na horizontal.
 *
 * O wrapper é o que impede a tabela de lançamentos (7 colunas) de empurrar a
 * página inteira no celular: ela rola dentro da própria caixa. `tabIndex={0}` no
 * wrapper deixa quem usa teclado rolar sem mouse.
 */
export function Table({ aria, className, children, ...props }: TableProps) {
  return (
    <div
      style={{ overflowX: 'auto', maxWidth: '100%' }}
      tabIndex={0}
      role="region"
      aria-label={aria}
    >
      <table className={['table', className ?? ''].join(' ').trim()} {...props}>
        {children}
      </table>
    </div>
  );
}

/** Célula alinhada à direita — valores em dinheiro. */
export function TdNumero({ children, style, ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return (
    <td style={{ textAlign: 'right', whiteSpace: 'nowrap', ...style }} {...props}>
      {children}
    </td>
  );
}

export function ThNumero({ children, style, ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return (
    <th scope="col" style={{ textAlign: 'right', ...style }} {...props}>
      {children}
    </th>
  );
}
