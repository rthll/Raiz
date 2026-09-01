import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Botão circular de 36px — usado nas setas do seletor de mês. */
  icone?: boolean;
  bloco?: boolean;
  children?: ReactNode;
}

/**
 * Botão do Organic.
 *
 * Só compõe as classes do design system — hover, pressed, foco e disabled já
 * vêm prontos do `styles.css` e não devem ser reescritos aqui.
 *
 * `type="button"` por padrão: dentro de um `<form>`, o padrão do HTML é
 * `submit`, e um botão de ação secundária que submete o formulário sem querer é
 * um bug silencioso.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', icone, bloco, className, type = 'button', ...props },
  ref,
) {
  const classes = [
    'btn',
    `btn-${variant}`,
    icone ? 'btn-icon' : '',
    bloco ? 'btn-block' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return <button ref={ref} type={type} className={classes} {...props} />;
});
