import { Skeleton } from '@raiz/ui';
import { Suspense, lazy, type ReactElement } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { Dashboard } from './screens/Dashboard.js';
import { AppShell } from './shell/AppShell.js';

/**
 * A visão geral entra no bundle principal — é a rota de entrada e carregá-la
 * separado só adicionaria uma ida ao servidor antes da primeira pintura.
 *
 * As outras nove vêm sob demanda. Investimentos e Cartões carregam o simulador e
 * a fatura; Contas carrega o diálogo de importação com o parser. Ninguém precisa
 * baixar isso para ver o dashboard.
 */
const Lancamentos = lazy(() => import('./screens/Lancamentos.js').then((m) => ({ default: m.Lancamentos })));
const Categorias = lazy(() => import('./screens/Categorias.js').then((m) => ({ default: m.Categorias })));
const Assinaturas = lazy(() => import('./screens/Assinaturas.js').then((m) => ({ default: m.Assinaturas })));
const Cartoes = lazy(() => import('./screens/Cartoes.js').then((m) => ({ default: m.Cartoes })));
const Investimentos = lazy(() => import('./screens/Investimentos.js').then((m) => ({ default: m.Investimentos })));
const Metas = lazy(() => import('./screens/Metas.js').then((m) => ({ default: m.Metas })));
const Relatorios = lazy(() => import('./screens/Relatorios.js').then((m) => ({ default: m.Relatorios })));
const Contas = lazy(() => import('./screens/Contas.js').then((m) => ({ default: m.Contas })));
const Onboarding = lazy(() => import('./screens/Onboarding.js').then((m) => ({ default: m.Onboarding })));
const Configuracoes = lazy(() => import('./screens/Configuracoes.js').then((m) => ({ default: m.Configuracoes })));
const KitchenSink = lazy(() => import('./screens/KitchenSink.js').then((m) => ({ default: m.KitchenSink })));

/**
 * Enquanto o pedaço da rota baixa, mostramos o mesmo esqueleto que as telas usam
 * enquanto os dados chegam. Um espaço em branco daria a impressão de travamento.
 */
function Carregando() {
  return (
    <div className="raiz-grid raiz-grid-panel" aria-busy="true" aria-live="polite">
      <span className="raiz-sr-only">Carregando a tela…</span>
      {Array.from({ length: 3 }, (_, i) => (
        <div className="card" key={i}>
          <Skeleton altura={12} largura="45%" />
          <Skeleton altura={27} largura="70%" raio={8} />
          <Skeleton altura={12} largura="60%" />
        </div>
      ))}
    </div>
  );
}

const sobDemanda = (tela: ReactElement) => <Suspense fallback={<Carregando />}>{tela}</Suspense>;

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'lancamentos', element: sobDemanda(<Lancamentos />) },
      { path: 'categorias', element: sobDemanda(<Categorias />) },
      { path: 'assinaturas', element: sobDemanda(<Assinaturas />) },
      { path: 'cartoes', element: sobDemanda(<Cartoes />) },
      { path: 'investimentos', element: sobDemanda(<Investimentos />) },
      { path: 'metas', element: sobDemanda(<Metas />) },
      { path: 'relatorios', element: sobDemanda(<Relatorios />) },
      { path: 'contas', element: sobDemanda(<Contas />) },
      { path: 'onboarding', element: sobDemanda(<Onboarding />) },
      { path: 'configuracoes', element: sobDemanda(<Configuracoes />) },
      // Vitrine do design system. Fora da navegação: é ferramenta de
      // desenvolvimento, não uma tela do produto.
      { path: 'design-system', element: sobDemanda(<KitchenSink />) },
    ],
  },
]);
