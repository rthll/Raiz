import { useCallback, useState } from 'react';
import type { ZodTypeAny, output } from 'zod';
import { ApiError } from '../api/client.js';

/**
 * Formulário validado pelos schemas de `@raiz/schemas`.
 *
 * Não usamos react-hook-form aqui: os formulários são planos, os schemas já
 * existem e já são compartilhados com a API, e a lógica cabe nestas ~80 linhas.
 * Uma dependência a mais só entraria para reimplementar o que o Zod já faz.
 *
 * A validação acontece no envio, e a partir daí a cada digitação — assim o campo
 * não fica vermelho antes de a pessoa terminar de escrever, mas o erro some
 * assim que ela corrige.
 */
export interface Formulario<T> {
  valores: Record<string, unknown>;
  erros: Record<string, string>;
  /** Erro que não pertence a um campo — conflito, falha de rede. */
  erroGeral: string | null;
  enviando: boolean;
  definir: (campo: string, valor: unknown) => void;
  /** Props prontas para um `<input>`/`<select>` controlado. */
  campo: (nome: string) => {
    value: string;
    onChange: (e: { target: { value: string } }) => void;
  };
  enviar: (aoValidar: (dados: T) => Promise<unknown>) => (e: React.FormEvent) => void;
  reiniciar: (valores?: Record<string, unknown>) => void;
}

export function useFormulario<S extends ZodTypeAny>(
  schema: S,
  iniciais: Record<string, unknown>,
): Formulario<output<S>> {
  const [valores, setValores] = useState(iniciais);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [jaTentou, setJaTentou] = useState(false);

  const validar = useCallback(
    (dados: Record<string, unknown>) => {
      const resultado = schema.safeParse(dados);
      if (resultado.success) return { ok: true as const, dados: resultado.data as output<S> };

      const campos: Record<string, string> = {};
      for (const issue of resultado.error.issues) {
        const chave = issue.path.join('.') || '_';
        campos[chave] ??= issue.message;
      }
      return { ok: false as const, campos };
    },
    [schema],
  );

  const definir = useCallback(
    (campo: string, valor: unknown) => {
      setValores((atual) => {
        const proximo = { ...atual, [campo]: valor };
        // Revalida só depois da primeira tentativa de envio.
        if (jaTentou) {
          const resultado = validar(proximo);
          setErros(resultado.ok ? {} : resultado.campos);
        }
        return proximo;
      });
    },
    [jaTentou, validar],
  );

  const campo = useCallback(
    (nome: string) => ({
      value: (valores[nome] ?? '') as string,
      onChange: (e: { target: { value: string } }) => definir(nome, e.target.value),
    }),
    [valores, definir],
  );

  const enviar = useCallback(
    (aoValidar: (dados: output<S>) => Promise<unknown>) => async (e: React.FormEvent) => {
      e.preventDefault();
      setJaTentou(true);
      setErroGeral(null);

      const resultado = validar(valores);
      if (!resultado.ok) {
        setErros(resultado.campos);
        return;
      }

      setErros({});
      setEnviando(true);
      try {
        await aoValidar(resultado.dados);
      } catch (erro) {
        if (erro instanceof ApiError && erro.campos) {
          // A API validou com o mesmo schema, então os nomes de campo batem.
          setErros(erro.campos);
          setErroGeral(null);
        } else {
          setErroGeral(
            erro instanceof ApiError ? erro.message : 'Não foi possível salvar. Tente de novo.',
          );
        }
      } finally {
        setEnviando(false);
      }
    },
    [valores, validar],
  );

  const reiniciar = useCallback((novos?: Record<string, unknown>) => {
    setValores(novos ?? {});
    setErros({});
    setErroGeral(null);
    setJaTentou(false);
  }, []);

  return { valores, erros, erroGeral, enviando, definir, campo, enviar, reiniciar };
}
