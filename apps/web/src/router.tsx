import { createBrowserRouter } from 'react-router-dom';
import { SCREENS } from './navigation.js';
import { EmConstrucao } from './screens/EmConstrucao.js';
import { KitchenSink } from './screens/KitchenSink.js';
import { AppShell } from './shell/AppShell.js';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: SCREENS.map((tela) => ({
      // A rota do dashboard é a index do shell.
      index: tela.path === '/',
      path: tela.path === '/' ? undefined : tela.path.slice(1),
      element: <EmConstrucao />,
    })).concat([
      // Vitrine do design system. Fora da navegacao: e ferramenta de
      // desenvolvimento, nao uma tela do produto.
      { index: false, path: 'design-system', element: <KitchenSink /> },
    ]),
  },
]);
