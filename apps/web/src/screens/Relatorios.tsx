import { formatBRL, formatPercent } from '@raiz/core';
import {
  Bar,
  Card,
  CardKicker,
  CardMeta,
  Dot,
  EmptyState,
  ErrorState,
  FluxoChart,
  Kpi,
  Money,
  SkeletonCard,
} from '@raiz/ui';
import { useCashflow, useRelatorios } from '../api/hooks.js';
import { useCompetencia } from '../state/competencia.js';
import { TelaHeader } from '../shell/TelaHeader.js';

const ROTULO_MES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export function Relatorios() {
  const { mes } = useCompetencia();
  const relatorios = useRelatorios(mes);
  const cashflow = useCashflow(mes, 8);

  if (relatorios.isError) {
    return (
      <>
        <TelaHeader />
        <ErrorState onTentarNovamente={() => void relatorios.refetch()} />
      </>
    );
  }

  if (relatorios.isPending) {
    return (
      <>
        <TelaHeader />
        <div className="raiz-grid raiz-grid-kpi">
          {Array.from({ length: 4 }, (_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </>
    );
  }

  const { kpis, maioresCategorias } = relatorios.data;
  const semDados = relatorios.data.entradas === 0 && relatorios.data.saidas === 0;
  const maior = Math.max(1, ...maioresCategorias.map((c) => c.gasto));

  return (
    <>
      <TelaHeader />

      {semDados ? (
        <EmptyState
          titulo="Nada para analisar neste mês"
          descricao="Assim que houver lançamentos, os indicadores aparecem aqui."
        />
      ) : (
        <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
          <div className="raiz-grid raiz-grid-kpi">
            <Kpi
              rotulo="Taxa de poupança"
              valor={kpis.taxaPoupanca}
              decimals={0}
              nota="do que entrou, quanto sobrou"
            />
            <Kpi
              rotulo="Custo fixo"
              valor={kpis.custoFixo}
              decimals={0}
              nota="moradia, assinaturas, saúde, educação"
            />
            <Kpi
              rotulo="Custo variável"
              valor={kpis.custoVariavel}
              decimals={0}
              nota="alimentação, lazer, transporte"
            />
            <Kpi
              rotulo="Meses de reserva"
              valor={kpis.mesesDeReserva}
              decimals={0}
              fundo="var(--color-accent-2-200)"
              nota={`reserva de ${formatBRL(kpis.reserva, { decimals: 0 })}`}
            />
          </div>

          <Card>
            <CardKicker>Entradas e saídas por mês</CardKicker>
            {cashflow.data ? (
              <FluxoChart
                altura={190}
                colunas={cashflow.data.meses.map((m) => {
                  const [, mm] = m.mes.split('-').map(Number);
                  return {
                    rotulo: ROTULO_MES[mm! - 1]!,
                    entradas: m.entradas,
                    saidas: m.saidas,
                    previsto: m.mes > mes,
                  };
                })}
              />
            ) : (
              <div style={{ height: 190 }} />
            )}
          </Card>

          <div className="raiz-grid raiz-grid-panel">
            <Card>
              <CardKicker>Maiores categorias do mês</CardKicker>
              {maioresCategorias.length === 0 ? (
                <CardMeta>Sem saídas registradas.</CardMeta>
              ) : (
                <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                  {maioresCategorias.slice(0, 8).map((item) => (
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

            <Insights
              taxaPoupanca={kpis.taxaPoupanca}
              custoFixo={kpis.custoFixo}
              custoVariavel={kpis.custoVariavel}
              mesesDeReserva={kpis.mesesDeReserva}
              maiorCategoria={maioresCategorias[0]}
              assinaturasAtivas={relatorios.data.assinaturasAtivas}
            />
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Leituras derivadas dos indicadores.
 *
 * O protótipo trazia insights fixos ("Alimentação subiu 18%"). Aqui eles são
 * calculados do dado real — um texto fixo mentiria assim que o dado mudasse.
 */
function Insights({
  taxaPoupanca,
  custoFixo,
  custoVariavel,
  mesesDeReserva,
  maiorCategoria,
  assinaturasAtivas,
}: {
  taxaPoupanca: number;
  custoFixo: number;
  custoVariavel: number;
  mesesDeReserva: number;
  maiorCategoria?: { categoria: { nome: string; cor: string }; gasto: number };
  assinaturasAtivas: number;
}) {
  const itens: Array<{ cor: string; texto: string }> = [];

  if (maiorCategoria) {
    itens.push({
      cor: maiorCategoria.categoria.cor,
      texto: `${maiorCategoria.categoria.nome} foi a maior saída do mês, com ${formatBRL(maiorCategoria.gasto)}.`,
    });
  }

  const total = custoFixo + custoVariavel;
  if (total > 0) {
    itens.push({
      cor: '#f6a06b',
      texto: `Custo fixo representa ${formatPercent((custoFixo / total) * 100)} do que é fixo mais variável.`,
    });
  }

  itens.push({
    cor: taxaPoupanca >= 20 ? '#8fa073' : '#b2622d',
    texto:
      taxaPoupanca >= 20
        ? `Você guardou ${formatPercent(taxaPoupanca)} do que entrou neste mês.`
        : `A taxa de poupança ficou em ${formatPercent(taxaPoupanca)} — abaixo dos 20% de referência.`,
  });

  itens.push({
    cor: mesesDeReserva >= 6 ? '#8fa073' : '#d67f48',
    texto: `A reserva cobre ${mesesDeReserva.toFixed(1).replace('.', ',')} meses de despesa.`,
  });

  if (assinaturasAtivas > 0) {
    itens.push({
      cor: '#645c50',
      texto: `${assinaturasAtivas} assinatura${assinaturasAtivas === 1 ? '' : 's'} ativa${assinaturasAtivas === 1 ? '' : 's'} entrando nas saídas todo mês.`,
    });
  }

  return (
    <Card>
      <CardKicker>O que mudou</CardKicker>
      <div>
        {itens.map((item) => (
          <div className="raiz-linha" key={item.texto} style={{ alignItems: 'flex-start' }}>
            <span style={{ paddingTop: 5 }}>
              <Dot cor={item.cor} />
            </span>
            <span style={{ fontSize: 13 }}>{item.texto}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
