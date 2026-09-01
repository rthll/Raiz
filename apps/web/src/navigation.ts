/**
 * As 10 telas do sistema, na ordem em que aparecem na sidebar.
 *
 * `kicker` e `titulo` vêm do mapa `TITULOS` do protótipo e alimentam o header
 * do main; `rotulo` é o texto do item de navegação.
 */
export interface Screen {
  id: string;
  path: string;
  rotulo: string;
  kicker: string;
  titulo: string;
}

export const SCREENS: readonly Screen[] = [
  { id: 'dashboard', path: '/', rotulo: 'Visão geral', kicker: 'Visão geral', titulo: 'Agosto de 2026' },
  { id: 'lancamentos', path: '/lancamentos', rotulo: 'Lançamentos', kicker: 'Movimentações', titulo: 'Lançamentos' },
  { id: 'categorias', path: '/categorias', rotulo: 'Categorias', kicker: 'Classificação', titulo: 'Categorias e limites' },
  { id: 'assinaturas', path: '/assinaturas', rotulo: 'Assinaturas', kicker: 'Serviços recorrentes', titulo: 'Assinaturas' },
  { id: 'cartoes', path: '/cartoes', rotulo: 'Cartões e faturas', kicker: 'Crédito', titulo: 'Cartões e faturas' },
  { id: 'investimentos', path: '/investimentos', rotulo: 'Investimentos', kicker: 'Patrimônio', titulo: 'Investimentos e projeções' },
  { id: 'metas', path: '/metas', rotulo: 'Metas e orçamentos', kicker: 'Planejamento', titulo: 'Metas e orçamentos' },
  { id: 'relatorios', path: '/relatorios', rotulo: 'Relatórios', kicker: 'Análise', titulo: 'Relatórios' },
  { id: 'contas', path: '/contas', rotulo: 'Contas', kicker: 'Origens', titulo: 'Contas e importações' },
  { id: 'onboarding', path: '/onboarding', rotulo: 'Primeiros passos', kicker: 'Configuração', titulo: 'Primeiros passos' },
] as const;

export function screenByPath(pathname: string): Screen {
  return SCREENS.find((s) => s.path === pathname) ?? SCREENS[0]!;
}
