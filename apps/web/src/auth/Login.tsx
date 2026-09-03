import { Button, Field, Input } from '@raiz/ui';
import { useState, type FormEvent } from 'react';
import { ApiError } from '../api/client.js';
import { useAuth } from './AuthProvider.js';

/**
 * Só o formulário: a marca e o card ficam em `Autenticacao`, que é a moldura
 * compartilhada com o cadastro.
 */
export function Login() {
  const { entrar } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await entrar(email, senha);
    } catch (e) {
      setErro(
        e instanceof ApiError ? e.message : 'Não foi possível entrar. Tente de novo em instantes.',
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <h3 style={{ margin: 0 }}>Entrar</h3>
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 'var(--space-3)' }} noValidate>
        <Field label="E-mail">
          {(p) => (
            <Input
              {...p}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          )}
        </Field>
        <Field label="Senha">
          {(p) => (
            <Input
              {...p}
              type="password"
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
            />
          )}
        </Field>

        {/* role="alert" para o leitor de tela anunciar a falha do login. */}
        {erro && (
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
            {erro}
          </div>
        )}

        <Button type="submit" variant="primary" bloco disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
    </>
  );
}
