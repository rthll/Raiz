import { useQuery } from '@tanstack/react-query';
import { screenByPath } from '../navigation.js';
import { useLocation } from 'react-router-dom';

interface Health {
  status: string;
  service: string;
  env: string;
  timestamp: string;
}

/**
 * Placeholder das 10 telas até a Etapa 5 construir cada uma.
 *
 * Serve a um propósito real no bootstrap: prova que roteamento, design system e
 * a ponte com a API estão de pé de ponta a ponta.
 */
export function EmConstrucao() {
  const { pathname } = useLocation();
  const tela = screenByPath(pathname);

  const health = useQuery<Health>({
    queryKey: ['health'],
    queryFn: async () => {
      const res = await fetch('/api/health');
      if (!res.ok) throw new Error(`API respondeu ${res.status}`);
      return res.json() as Promise<Health>;
    },
  });

  return (
    <div className="raiz-grid raiz-grid-panel riseIn">
      <section className="card">
        <div className="card-kicker">Etapa 5</div>
        <h3 className="card-title">{tela.titulo}</h3>
        <p className="card-body">
          Esta tela ainda não foi construída. O shell, o roteamento e o design system Organic já
          estão no lugar — o conteúdo entra na onda de telas.
        </p>
        <div className="card-meta">rota {tela.path}</div>
      </section>

      <section className="card">
        <div className="card-kicker">Conexão</div>
        <h3 className="card-title">Backend</h3>
        {health.isPending && <p className="card-body">Consultando a API…</p>}
        {health.isError && (
          <p className="card-body">
            Sem resposta da API. Suba o Fastify com <code>pnpm dev</code> na raiz.
          </p>
        )}
        {health.data && (
          <>
            <p className="card-body">
              <span className="tag tag-accent-2">{health.data.status}</span> {health.data.service} ·{' '}
              {health.data.env}
            </p>
            <div className="card-meta">{health.data.timestamp}</div>
          </>
        )}
      </section>
    </div>
  );
}
