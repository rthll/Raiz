import { PrivacyProvider } from '@raiz/ui';
import { RouterProvider } from 'react-router-dom';
import { AuthProvider, usePreferencias, useAuth } from './auth/AuthProvider.js';
import { Login } from './auth/Login.js';
import { router } from './router.js';
import { CompetenciaProvider } from './state/competencia.js';

/**
 * Portão de sessão.
 *
 * Enquanto o refresh inicial não responde, não dá para saber se há sessão — e
 * piscar o login para quem já está autenticado é pior do que uma espera curta.
 */
function Portao() {
  const { usuario, carregando } = useAuth();
  const { modoPrivacidade } = usePreferencias();

  if (carregando) {
    return (
      <div
        style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}
        aria-busy="true"
        aria-live="polite"
      >
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: 20 }}>Raiz</span>
      </div>
    );
  }

  if (!usuario) return <Login />;

  return (
    <PrivacyProvider ativo={modoPrivacidade}>
      <CompetenciaProvider>
        <RouterProvider router={router} />
      </CompetenciaProvider>
    </PrivacyProvider>
  );
}

export function App() {
  return (
    <AuthProvider>
      <Portao />
    </AuthProvider>
  );
}
