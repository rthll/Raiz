import { describe, expect, it } from 'vitest';
import { SCREENS, screenByPath } from './navigation.js';

/**
 * O handoff lista 10 telas e as rotas exatas de cada uma. Um erro de digitação
 * aqui vira um link morto na sidebar, então vale travar a lista.
 */
const ROTAS_DO_HANDOFF = [
  '/',
  '/lancamentos',
  '/categorias',
  '/assinaturas',
  '/cartoes',
  '/investimentos',
  '/metas',
  '/relatorios',
  '/contas',
  '/onboarding',
];

describe('navegação', () => {
  it('tem as 10 telas nas rotas que o handoff define', () => {
    expect(SCREENS).toHaveLength(10);
    expect(SCREENS.map((s) => s.path)).toEqual(ROTAS_DO_HANDOFF);
  });

  it('não repete id nem rota', () => {
    expect(new Set(SCREENS.map((s) => s.id)).size).toBe(SCREENS.length);
    expect(new Set(SCREENS.map((s) => s.path)).size).toBe(SCREENS.length);
  });

  it('preenche kicker e título de toda tela — os dois alimentam o header', () => {
    for (const tela of SCREENS) {
      expect(tela.kicker.length).toBeGreaterThan(0);
      expect(tela.titulo.length).toBeGreaterThan(0);
      expect(tela.rotulo.length).toBeGreaterThan(0);
    }
  });

  it('resolve a tela pelo pathname', () => {
    expect(screenByPath('/cartoes').id).toBe('cartoes');
    expect(screenByPath('/').id).toBe('dashboard');
  });

  it('cai no dashboard para rota desconhecida em vez de quebrar', () => {
    expect(screenByPath('/rota-que-nao-existe').id).toBe('dashboard');
  });
});
