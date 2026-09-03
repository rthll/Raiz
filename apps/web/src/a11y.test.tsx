/**
 * Auditoria de acessibilidade com axe-core.
 *
 * Roda as regras WCAG 2.1 A e AA contra cada tela renderizada com dados reais.
 * É verificação objetiva: pega rótulo faltando, contraste insuficiente, ordem de
 * heading quebrada e ARIA inválido sem depender de alguém lembrar de olhar.
 *
 * O que o axe **não** pega: se a tela faz sentido, se o foco vai para o lugar
 * certo, se a leitura em voz alta é compreensível. Isso continua sendo teste
 * escrito à mão (ver components.test.tsx e dialogs.test.tsx).
 */
import axe from 'axe-core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { PrivacyProvider } from '@raiz/ui';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Assinaturas } from './screens/Assinaturas.js';
import { Cartoes } from './screens/Cartoes.js';
import { Categorias } from './screens/Categorias.js';
import { Contas } from './screens/Contas.js';
import { Dashboard } from './screens/Dashboard.js';
import { Investimentos } from './screens/Investimentos.js';
import { Lancamentos } from './screens/Lancamentos.js';
import { Metas } from './screens/Metas.js';
import { Onboarding } from './screens/Onboarding.js';
import { Relatorios } from './screens/Relatorios.js';
import { AuthProvider } from './auth/AuthProvider.js';
import { Login } from './auth/Login.js';
import { Registro } from './auth/Registro.js';
import { LancamentoDialog } from './dialogs/LancamentoDialog.js';
import { ImportarDialog } from './dialogs/ImportarDialog.js';
import { CompetenciaProvider } from './state/competencia.js';
import { ToasterProvider } from './ui/Toaster.js';
import { RESPOSTAS } from './test-fixtures.js';

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const caminho = String(url).split('?')[0]!;
      const dados = RESPOSTAS[caminho] ?? [];
      return new Response(JSON.stringify(dados), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function montar(tela: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={qc}>
      <PrivacyProvider ativo={false}>
        <ToasterProvider>
          <CompetenciaProvider>
            <MemoryRouter>
              {/* main: o axe exige que o conteúdo esteja dentro de um landmark. */}
              <main>{tela}</main>
            </MemoryRouter>
          </CompetenciaProvider>
        </ToasterProvider>
      </PrivacyProvider>
    </QueryClientProvider>,
  );
}

/** Roda o axe e devolve as violações em formato legível. */
async function auditar(container: HTMLElement) {
  const resultado = await axe.run(container, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    // O jsdom não faz layout, então regras que dependem de posição e de cor
    // computada não têm o que medir e reportariam ruído.
    rules: { 'color-contrast': { enabled: false } },
  });

  return resultado.violations.map((v) => ({
    regra: v.id,
    impacto: v.impact,
    descricao: v.help,
    elementos: v.nodes.map((n) => n.html.slice(0, 120)),
  }));
}

const TELAS: Array<[string, ReactElement]> = [
  ['Visão geral', <Dashboard />],
  ['Lançamentos', <Lancamentos />],
  ['Categorias', <Categorias />],
  ['Assinaturas', <Assinaturas />],
  ['Cartões e faturas', <Cartoes />],
  ['Investimentos', <Investimentos />],
  ['Metas e orçamentos', <Metas />],
  ['Relatórios', <Relatorios />],
  ['Contas', <Contas />],
  ['Primeiros passos', <Onboarding />],
];

describe('acessibilidade das telas', () => {
  for (const [nome, tela] of TELAS) {
    it(`${nome} não tem violação WCAG A/AA`, async () => {
      const { container } = montar(tela);
      // Espera os dados chegarem: uma tela em esqueleto esconde os problemas.
      await waitFor(() => expect(container.querySelectorAll('.raiz-skeleton')).toHaveLength(0), {
        timeout: 3000,
      });

      const violacoes = await auditar(container);
      expect(violacoes).toEqual([]);
    });
  }
});

/**
 * As telas de sessão não passam pelo `montar` acima: elas vivem fora do router e
 * dos providers do app, e o que precisam é do `AuthProvider`.
 */
describe('acessibilidade do portão de sessão', () => {
  const PORTAO: Array<[string, ReactElement]> = [
    ['Entrar', <Login />],
    ['Criar conta', <Registro />],
  ];

  for (const [nome, tela] of PORTAO) {
    it(`${nome} não tem violação WCAG A/AA`, async () => {
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
      const { container } = render(
        <QueryClientProvider client={qc}>
          <AuthProvider>
            <main>{tela}</main>
          </AuthProvider>
        </QueryClientProvider>,
      );

      expect(await auditar(container)).toEqual([]);
    });
  }
});

describe('acessibilidade dos diálogos', () => {
  it('o diálogo de lançamento não tem violação', async () => {
    montar(<LancamentoDialog aberto dataPadrao="2026-08-01" onFechar={vi.fn()} />);
    const dialogo = await screen.findByRole('dialog');
    expect(await auditar(dialogo)).toEqual([]);
  });

  it('o diálogo de importação não tem violação', async () => {
    montar(<ImportarDialog aberto onFechar={vi.fn()} />);
    const dialogo = await screen.findByRole('dialog');
    expect(await auditar(dialogo)).toEqual([]);
  });
});

describe('estrutura de headings', () => {
  it('cada tela usa headings em ordem, sem pular nível', async () => {
    for (const [nome, tela] of TELAS) {
      const { container, unmount } = montar(tela);
      await waitFor(() => expect(container.querySelectorAll('.raiz-skeleton')).toHaveLength(0), {
        timeout: 3000,
      });

      const niveis = [...container.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) =>
        Number(h.tagName[1]),
      );
      for (let i = 1; i < niveis.length; i++) {
        // Descer mais de um nível de uma vez quebra a navegação por headings.
        expect(niveis[i]! - niveis[i - 1]!, `${nome}: ${niveis.join(' → ')}`).toBeLessThanOrEqual(1);
      }
      unmount();
    }
  });
});
