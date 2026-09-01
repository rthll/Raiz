import { formatBRL, formatPercent } from '@raiz/core';
import {
  Bar,
  Button,
  Card,
  CardKicker,
  CardMeta,
  CardTitle,
  Dot,
  ErrorState,
  FluxoChart,
  Kpi,
  Money,
  Monogram,
  SkeletonCard,
} from '@raiz/ui';
import { useNavigate } from 'react-router-dom';
import { useCashflow, useDashboard } from '../api/hooks.js';
import type { Dashboard as DashboardDTO } from '../api/types.js';
import { usePreferencias } from '../auth/AuthProvider.js';
import { useCompetencia } from '../state/competencia.js';
import { BannerAlerta, TelaHeader } from '../shell/TelaHeader.js';

const ROTULO_MES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const NOME_RESPONSAVEL = { ANA: 'Ana', BRUNO: 'Bruno', CONJUNTA: 'Conjunta' } as const;
const COR_RESPONSAVEL = {
  ANA: 'var(--color-accent)',
  BRUNO: 'var(--color-accent-2-500)',
  CONJUNTA: 'var(--color-neutral-500)',
} as const;

export function Dashboard() {
  const { mes } = useCompetencia();
  const { modoCasal, alertasVencimento } = usePreferencias();
  const navigate = useNavigate();

  const dashboard = useDashboard(mes);
  const cashflow = useCashflow(mes, 8);

  return (
    <>
      <TelaHeader
        acoes={
          <>
            <Button variant="secondary" onClick={() => navigate('/contas')}>
              Importar CSV/OFX
            </Button>
            <Button variant="primary" onClick={() => navigate('/lancamentos')}>
              Novo lançamento
            </Button>
          </>
        }
      />

      {alertasVencimento && dashboard.data && <Alertas dados={dashboard.data} />}

      {dashboard.isError && <ErrorState onTentarNovamente={() => void dashboard.refetch()} />}

      {dashboard.isPending && (
        <div className="raiz-grid raiz-grid-kpi">
          {Array.from({ length: 4 }, (_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {dashboard.data && (
        <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
          <Kpis dados={dashboard.data} />

          <div className="raiz-grid raiz-grid-panel">
            <Card>
              <CardKicker>Fluxo de caixa</CardKicker>
              {cashflow.data ? (
                <FluxoChart
                  colunas={cashflow.data.meses.map((m) => {
                    const [, mm] = m.mes.split('-').map(Number);
                    return {
                      rotulo: ROTULO_MES[mm! - 1]!,
                      entradas: m.entradas,
                      saidas: m.saidas,
                      // Meses depois do selecionado são previsão, não realizado.
                      previsto: m.mes > mes,
                    };
                  })}
                />
              ) : (
                <div style={{ height: 176 }} />
              )}
            </Card>

            <ParaOndeFoi dados={dashboard.data} />
          </div>

          <div className="raiz-grid raiz-grid-panel">
            <ProximosVencimentos dados={dashboard.data} />
            {modoCasal && <DivisaoCasal dados={dashboard.data} />}
            <Investido dados={dashboard.data} />
          </div>
        </div>
      )}
    </>
  );
}

function Alertas({ dados }: { dados: DashboardDTO }) {
  const { testeGratis, faturaFechando } = dados.alertas;
  if (!testeGratis && !faturaFechando) return null;

  const partes: string[] = [];
  if (testeGratis) {
    const dia = testeGratis.data.slice(8, 10);
    const mes = testeGratis.data.slice(5, 7);
    partes.push(
      `${testeGratis.nome} sai do teste grátis em ${dia}/${mes}` +
        (testeGratis.passaACustar
          ? ` e passa a custar ${formatBRL(testeGratis.passaACustar).replace('R$ ', '')}.`
          : '.'),
    );
  }
  if (faturaFechando) {
    partes.push(`A fatura do ${faturaFechando.nome} fecha no dia ${faturaFechando.dia}.`);
  }

  return <BannerAlerta texto={partes.join(' ')} />;
}

function Kpis({ dados }: { dados: DashboardDTO }) {
  const { kpis } = dados;
  return (
    <div className="raiz-grid raiz-grid-kpi">
      <Kpi rotulo="Saldo em contas" valor={kpis.saldoContas} nota="somando todas as contas" />
      <Kpi
        rotulo="Entradas do mês"
        valor={kpis.entradas}
        corValor="var(--color-accent-2-700)"
        nota={`saldo do mês ${formatBRL(kpis.saldoDoMes)}`}
      />
      <Kpi
        rotulo="Saídas do mês"
        valor={kpis.saidas}
        corValor="var(--color-accent-700)"
        nota={<>{formatBRL(kpis.custoAssinaturas)} são assinaturas</>}
      />
      <Kpi
        rotulo="Patrimônio total"
        valor={kpis.patrimonio}
        decimals={0}
        fundo="var(--color-accent-900)"
        cor="var(--color-neutral-100)"
        nota={`${formatBRL(kpis.investido, { decimals: 0 })} investidos`}
      />
    </div>
  );
}

function ParaOndeFoi({ dados }: { dados: DashboardDTO }) {
  const maior = Math.max(1, ...dados.gastoPorCategoria.map((c) => c.gasto));

  return (
    <Card>
      <CardKicker>Para onde o dinheiro foi</CardKicker>
      {dados.gastoPorCategoria.length === 0 ? (
        <CardMeta>Nenhuma saída registrada neste mês.</CardMeta>
      ) : (
        <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
          {dados.gastoPorCategoria.map((item) => (
            <div key={item.categoria.id}>
              <div className="raiz-row" style={{ marginBottom: 6 }}>
                <Dot cor={item.categoria.cor} />
                <span style={{ fontSize: 14 }}>{item.categoria.nome}</span>
                <span className="raiz-push" style={{ fontSize: 14, fontWeight: 600 }}>
                  <Money valor={item.gasto} />
                </span>
              </div>
              <Bar
                pct={(item.gasto / maior) * 100}
                cor={item.categoria.cor}
                aria={`${item.categoria.nome}: ${formatBRL(item.gasto)}`}
              />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function ProximosVencimentos({ dados }: { dados: DashboardDTO }) {
  return (
    <Card>
      <CardKicker>Próximos vencimentos</CardKicker>
      {dados.vencimentos.length === 0 ? (
        <CardMeta>Nada vencendo por aqui.</CardMeta>
      ) : (
        <div>
          {dados.vencimentos.map((v) => (
            <div className="raiz-linha" key={`${v.tipo}-${v.nome}`}>
              <Monogram
                texto={v.data.slice(8, 10)}
                tamanho={40}
                fundo={v.destaque ? 'var(--color-accent-200)' : 'var(--color-neutral-200)'}
                cor={v.destaque ? 'var(--color-accent-900)' : 'var(--color-neutral-800)'}
              />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14 }}>{v.nome}</div>
                <div style={{ fontSize: 11, color: 'var(--color-neutral-600)' }}>{v.detalhe}</div>
              </div>
              <span className="raiz-push" style={{ fontSize: 14, fontWeight: 600 }}>
                <Money valor={v.valor} />
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function DivisaoCasal({ dados }: { dados: DashboardDTO }) {
  const { porResponsavel, acerto } = dados.divisaoCasal;
  const [ana, bruno] = porResponsavel;
  // Quem gastou menos transfere para quem gastou mais.
  const quemPaga = (ana?.gasto ?? 0) > (bruno?.gasto ?? 0) ? 'Bruno' : 'Ana';
  const quemRecebe = quemPaga === 'Bruno' ? 'Ana' : 'Bruno';

  return (
    <Card>
      <CardKicker>Divisão do casal</CardKicker>
      <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
        {porResponsavel.map((p) => (
          <div key={p.responsavel}>
            <div className="raiz-row" style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 14 }}>{NOME_RESPONSAVEL[p.responsavel]}</span>
              <span className="raiz-push" style={{ fontSize: 13 }}>
                <Money valor={p.gasto} /> · {formatPercent(p.percentual)}
              </span>
            </div>
            <Bar
              pct={p.percentual}
              cor={COR_RESPONSAVEL[p.responsavel]}
              aria={`${NOME_RESPONSAVEL[p.responsavel]}: ${formatPercent(p.percentual)} das saídas`}
            />
          </div>
        ))}
      </div>
      {acerto > 0 && (
        <div
          style={{
            background: 'var(--color-accent-2-100)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-2) var(--space-3)',
            fontSize: 13,
          }}
        >
          Acerto do mês: {quemPaga} transfere <Money valor={acerto} /> para {quemRecebe}.
        </div>
      )}
    </Card>
  );
}

function Investido({ dados }: { dados: DashboardDTO }) {
  const navigate = useNavigate();
  const { investimentos } = dados;

  return (
    <Card>
      <CardKicker>Investido</CardKicker>
      <CardTitle>
        <Money valor={investimentos.total} decimals={0} />
      </CardTitle>
      <CardMeta>
        taxa média de {formatPercent(investimentos.taxaMediaPonderada, 1)} a.a. · aporte de{' '}
        {formatBRL(investimentos.aporteMensal, { decimals: 0 })} por mês
      </CardMeta>
      <Button variant="secondary" onClick={() => navigate('/investimentos')}>
        Ver investimentos
      </Button>
    </Card>
  );
}
