import { Menu, X } from 'lucide-react';
import { Button, ICON_STROKE_WIDTH, Money } from '@raiz/ui';
import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { SCREENS, screenByPath } from '../navigation.js';

/**
 * Shell de duas colunas: sidebar de 252px + main.
 *
 * No desktop o `flex-wrap` do handoff resolve sozinho. No celular a sidebar
 * inteira não cabe — vira um drawer, que é o que o handoff pede para "mobile
 * real". O drawer é o mesmo `<nav>`, só reposicionado: um menu duplicado sairia
 * de sincronia com o outro na primeira mudança.
 */
export function AppShell({ saldoPrevisto }: { saldoPrevisto?: number }) {
  const { pathname } = useLocation();
  const tela = screenByPath(pathname);
  const [drawerAberto, setDrawerAberto] = useState(false);
  const botaoMenu = useRef<HTMLButtonElement>(null);

  // Trocar de tela fecha o drawer — senão ele fica por cima do conteúdo novo.
  useEffect(() => {
    setDrawerAberto(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerAberto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDrawerAberto(false);
        botaoMenu.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [drawerAberto]);

  return (
    <div className="shell" data-drawer={drawerAberto ? 'aberto' : undefined}>
      {/* Pular direto para o conteúdo: o primeiro Tab de quem usa teclado. */}
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo
      </a>

      <aside className="sidebar" id="sidebar">
        <div className="sidebar-topo">
          <div className="brand">
            <div className="brand-mark" aria-hidden="true" />
            <div>
              <div className="brand-nome">Raiz</div>
              <div className="brand-sub">finanças da casa</div>
            </div>
          </div>
          <Button
            ref={botaoMenu}
            variant="ghost"
            icone
            className="so-mobile"
            aria-label={drawerAberto ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={drawerAberto}
            aria-controls="nav-principal"
            onClick={() => setDrawerAberto((v) => !v)}
          >
            {drawerAberto ? (
              <X size={20} strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" />
            ) : (
              <Menu size={20} strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" />
            )}
          </Button>
        </div>

        <nav className="nav-vertical" id="nav-principal" aria-label="Navegação principal">
          {SCREENS.map((s) => (
            <NavLink key={s.id} to={s.path} end={s.path === '/'} className="nav-item">
              {s.rotulo}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-rodape">
          <div className="card" style={{ background: 'var(--color-accent-2-200)' }}>
            <div className="card-kicker">Saldo previsto</div>
            {saldoPrevisto == null ? (
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 22 }}>—</div>
            ) : (
              <Money
                valor={saldoPrevisto}
                decimals={0}
                style={{ fontFamily: 'var(--font-heading)', fontSize: 22 }}
              />
            )}
            <div className="card-meta">disponível até o fim do mês</div>
          </div>
        </div>
      </aside>

      {/* Fecha o drawer ao tocar fora. Só existe no mobile, com o drawer aberto. */}
      {drawerAberto && (
        <div className="drawer-backdrop" onClick={() => setDrawerAberto(false)} aria-hidden="true" />
      )}

      <main className="main" id="conteudo">
        <header className="main-header">
          <div>
            <div className="card-kicker">{tela.kicker}</div>
            <h2 style={{ margin: 0 }}>{tela.titulo}</h2>
          </div>
        </header>
        <Outlet />
      </main>
    </div>
  );
}
