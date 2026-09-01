import { createBrowserRouter } from 'react-router-dom';
import { Assinaturas } from './screens/Assinaturas.js';
import { Cartoes } from './screens/Cartoes.js';
import { Categorias } from './screens/Categorias.js';
import { Contas } from './screens/Contas.js';
import { Dashboard } from './screens/Dashboard.js';
import { Investimentos } from './screens/Investimentos.js';
import { KitchenSink } from './screens/KitchenSink.js';
import { Lancamentos } from './screens/Lancamentos.js';
import { Metas } from './screens/Metas.js';
import { Onboarding } from './screens/Onboarding.js';
import { Relatorios } from './screens/Relatorios.js';
import { AppShell } from './shell/AppShell.js';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'lancamentos', element: <Lancamentos /> },
      { path: 'categorias', element: <Categorias /> },
      { path: 'assinaturas', element: <Assinaturas /> },
      { path: 'cartoes', element: <Cartoes /> },
      { path: 'investimentos', element: <Investimentos /> },
      { path: 'metas', element: <Metas /> },
      { path: 'relatorios', element: <Relatorios /> },
      { path: 'contas', element: <Contas /> },
      { path: 'onboarding', element: <Onboarding /> },
      // Vitrine do design system. Fora da navegação: é ferramenta de
      // desenvolvimento, não uma tela do produto.
      { path: 'design-system', element: <KitchenSink /> },
    ],
  },
]);
