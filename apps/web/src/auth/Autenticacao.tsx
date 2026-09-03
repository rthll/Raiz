import { Card, Skeleton } from '@raiz/ui';
import { Suspense, lazy, useState } from 'react';
import { Login } from './Login.js';

type Modo = 'entrar' | 'criar';

/**
 * O cadastro vem sob demanda porque arrasta o zod e os schemas compartilhados —
 * 61 kB que, no bundle de entrada, todo mundo que só quer entrar baixaria à toa.
 * O login não valida no cliente: quem erra a senha descobre pela API.
 */
const Registro = lazy(() => import('./Registro.js').then((m) => ({ default: m.Registro })));

/** Mesma altura do formulário, para o card não saltar enquanto o pedaço chega. */
function CarregandoFormulario() {
  return (
    <div aria-busy="true" aria-live="polite" style={{ display: 'grid', gap: 'var(--space-3)' }}>
      <span className="raiz-sr-only">Carregando o formulário…</span>
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} style={{ display: 'grid', gap: 6 }}>
          <Skeleton altura={11} largura="35%" />
          <Skeleton altura={38} raio={8} />
        </div>
      ))}
    </div>
  );
}

/**
 * Moldura das duas telas de sessão.
 *
 * Entrar e criar conta dividem a marca e o card em vez de cada uma montar o
 * seu — assim alternar não desloca o card na tela. A alternância é estado, não
 * rota: quem não tem sessão não tem router montado (ver `Portao` em App.tsx), e
 * subir um segundo router só para duas telas seria peso sem retorno.
 *
 * Trocar de modo remonta o formulário, e é isso que faz o `autoFocus` do
 * primeiro campo valer nas duas direções.
 */
export function Autenticacao() {
  const [modo, setModo] = useState<Modo>('entrar');
  const criando = modo === 'criar';

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: 'var(--space-4)',
        background: 'var(--color-bg)',
      }}
    >
      <div style={{ width: 'min(400px, 100%)' }}>
        <div
          className="raiz-row"
          style={{ justifyContent: 'center', marginBottom: 'var(--space-6)' }}
        >
          <div
            aria-hidden="true"
            style={{ width: 44, height: 44, borderRadius: 999, background: 'var(--color-accent)' }}
          />
          <div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 24, lineHeight: 1.1 }}>
              Raiz
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}>finanças da casa</div>
          </div>
        </div>

        <Card elevacao="md">
          {criando ? (
            <Suspense fallback={<CarregandoFormulario />}>
              <Registro />
            </Suspense>
          ) : (
            <Login />
          )}

          <p
            style={{
              margin: 0,
              textAlign: 'center',
              fontSize: 12,
              color: 'var(--color-neutral-600)',
            }}
          >
            {criando ? 'Já tem uma conta? ' : 'Ainda não tem conta? '}
            <button
              type="button"
              onClick={() => setModo(criando ? 'entrar' : 'criar')}
              style={{
                background: 'none',
                border: 0,
                padding: 0,
                font: 'inherit',
                color: 'var(--color-accent-700)',
                textDecoration: 'underline',
                cursor: 'pointer',
              }}
            >
              {criando ? 'Entrar' : 'Criar conta'}
            </button>
          </p>
        </Card>
      </div>
    </div>
  );
}
