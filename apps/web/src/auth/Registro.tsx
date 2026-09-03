import { registroSchema } from '@raiz/schemas';
import { Button, Field, Input } from '@raiz/ui';
import { z } from 'zod';
import { useFormulario } from '../forms/useFormulario.js';
import { useAuth } from './AuthProvider.js';

/**
 * O nome da casa é opcional, mas o schema compartilhado exige pelo menos um
 * caractere quando ele vem — e um campo que a pessoa tocou e depois esvaziou
 * chega como `''`, não como ausente. Aqui, em branco significa "não informado":
 * a API nomeia a casa a partir do nome de quem se cadastrou.
 *
 * A conversão mora no schema, e não no `onChange`, para o campo continuar
 * mostrando exatamente o que foi digitado enquanto se digita.
 */
const schemaDoFormulario = registroSchema.extend({
  household: z.preprocess(
    (valor) => (typeof valor === 'string' && valor.trim() === '' ? undefined : valor),
    registroSchema.shape.household,
  ),
});

export function Registro() {
  const { criarConta } = useAuth();
  const form = useFormulario(schemaDoFormulario, {
    nome: '',
    email: '',
    senha: '',
    household: '',
  });

  return (
    <>
      <h3 style={{ margin: 0 }}>Criar conta</h3>
      <form
        onSubmit={form.enviar((dados) => criarConta(dados))}
        style={{ display: 'grid', gap: 'var(--space-3)' }}
        noValidate
      >
        <Field label="Nome" erro={form.erros.nome}>
          {(p) => <Input {...p} {...form.campo('nome')} autoComplete="name" required autoFocus />}
        </Field>

        <Field label="E-mail" erro={form.erros.email}>
          {(p) => (
            <Input {...p} {...form.campo('email')} type="email" autoComplete="email" required />
          )}
        </Field>

        <Field label="Senha" erro={form.erros.senha} dica="Pelo menos 8 caracteres.">
          {(p) => (
            <Input
              {...p}
              {...form.campo('senha')}
              type="password"
              autoComplete="new-password"
              required
            />
          )}
        </Field>

        <Field
          label="Nome da casa"
          erro={form.erros.household}
          dica="Opcional — sem isso, usamos o seu nome."
        >
          {(p) => <Input {...p} {...form.campo('household')} autoComplete="off" />}
        </Field>

        {/* role="alert" para o leitor de tela anunciar a falha do cadastro. */}
        {form.erroGeral && (
          <div
            role="alert"
            style={{
              fontSize: 13,
              padding: 'var(--space-2) var(--space-3)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-accent-200)',
              color: 'var(--color-accent-900)',
            }}
          >
            {form.erroGeral}
          </div>
        )}

        <Button type="submit" variant="primary" bloco disabled={form.enviando}>
          {form.enviando ? 'Criando…' : 'Criar conta'}
        </Button>
      </form>
    </>
  );
}
