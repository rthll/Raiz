import { formatBRL, formatPercent } from '@raiz/core';
import { Button, Card, CardKicker, CardMeta, CardTitle } from '@raiz/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAtivos, useCategorias, useContas, useResumoAssinaturas } from '../api/hooks.js';
import { useCompetencia } from '../state/competencia.js';
import { TelaHeader } from '../shell/TelaHeader.js';

interface Passo {
  titulo: string;
  descricao: string;
  cta: string;
  itens: Array<{ titulo: string; nota: string }>;
}

export function Onboarding() {
  const [passo, setPasso] = useState(1);
  const navigate = useNavigate();
  const { mes } = useCompetencia();

  const contas = useContas();
  const categorias = useCategorias();
  const ativos = useAtivos();
  const assinaturas = useResumoAssinaturas(mes);

  /**
   * Os passos leem o estado real da conta.
   *
   * O protótipo trazia textos fixos ("8 assinaturas"); aqui o número vem do
   * banco, senão o onboarding mentiria para quem começa do zero.
   */
  const passos: Passo[] = [
    {
      titulo: 'Conecte suas contas',
      descricao:
        'Importe um extrato CSV ou OFX de cada banco. O Raiz reconhece o formato e evita duplicidade.',
      cta: 'Continuar',
      itens:
        contas.data?.slice(0, 3).map((c) => ({
          titulo: c.nome,
          nota: c.ultimaSync ? 'extrato importado' : 'aguardando arquivo',
        })) ?? [{ titulo: 'Nenhuma conta ainda', nota: 'comece cadastrando uma' }],
    },
    {
      titulo: 'Cadastre seus cartões',
      descricao:
        'Informe limite, fechamento e vencimento para que a fatura seja montada com os lançamentos certos.',
      cta: 'Continuar',
      itens: [
        { titulo: 'Fechamento', nota: 'dia em que a fatura fecha' },
        { titulo: 'Vencimento', nota: 'dia do pagamento' },
        { titulo: 'Limite', nota: 'usado no alerta de crédito' },
      ],
    },
    {
      titulo: 'Ajuste suas categorias',
      descricao:
        'Comece com as categorias sugeridas, renomeie o que quiser e defina um limite mensal para cada uma.',
      cta: 'Continuar',
      itens: [
        {
          titulo: `${categorias.data?.length ?? 0} categorias`,
          nota: 'edite, exclua ou crie novas',
        },
        { titulo: 'Limites mensais', nota: 'geram os alertas de orçamento' },
        { titulo: 'Regras automáticas', nota: 'classificam pelo texto do extrato' },
      ],
    },
    {
      titulo: 'Cadastre assinaturas e ativos',
      descricao:
        'Assinaturas viram previsão de saída; ativos com taxa de retorno alimentam as projeções de patrimônio.',
      cta: 'Ir para o painel',
      itens: [
        {
          titulo: `${(assinaturas.data?.ativas ?? 0) + (assinaturas.data?.pausadas ?? 0)} assinaturas`,
          nota: assinaturas.data
            ? `${formatBRL(assinaturas.data.custoMensal)} por mês`
            : 'ainda carregando',
        },
        {
          titulo: `${ativos.data?.length ?? 0} ativos`,
          nota: ativos.data?.length
            ? `taxa média de ${formatPercent(
                ativos.data.reduce((a, x) => a + x.taxaAnual * x.valor, 0) /
                  Math.max(1, ativos.data.reduce((a, x) => a + x.valor, 0)),
                1,
              )} a.a.`
            : 'cadastre para projetar',
        },
        { titulo: 'Projeções', nota: 'juros compostos mês a mês' },
      ],
    },
  ];

  const atual = passos[passo - 1]!;

  return (
    <>
      <TelaHeader semMes />

      <div className="raiz-row" style={{ marginBottom: 'var(--space-4)' }}>
        {passos.map((p, i) => {
          const numero = i + 1;
          const eAtual = numero === passo;
          const concluido = numero < passo;
          return (
            <button
              key={p.titulo}
              type="button"
              onClick={() => setPasso(numero)}
              aria-current={eAtual ? 'step' : undefined}
              style={{
                fontSize: 12,
                padding: '6px 14px',
                borderRadius: 999,
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                background: eAtual
                  ? 'var(--color-accent)'
                  : concluido
                    ? 'var(--color-accent-2-200)'
                    : 'var(--color-neutral-200)',
                color: eAtual ? 'var(--color-bg)' : 'var(--color-neutral-800)',
              }}
            >
              {numero}. {p.titulo}
            </button>
          );
        })}
      </div>

      {/* key força a animação de entrada a repetir a cada troca de passo. */}
      <Card key={passo} className="riseIn">
        <CardKicker>Passo {passo} de 4</CardKicker>
        <h3 style={{ margin: 0 }}>{atual.titulo}</h3>
        <p className="card-body" style={{ flex: 'none' }}>
          {atual.descricao}
        </p>

        <div className="raiz-grid raiz-grid-card">
          {atual.itens.map((item) => (
            <div
              key={item.titulo}
              style={{
                background: 'var(--color-neutral-100)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-3)',
              }}
            >
              <CardTitle>{item.titulo}</CardTitle>
              <CardMeta>{item.nota}</CardMeta>
            </div>
          ))}
        </div>

        <div className="raiz-row">
          <Button variant="secondary" disabled={passo === 1} onClick={() => setPasso(passo - 1)}>
            Voltar
          </Button>
          <Button
            variant="primary"
            onClick={() => (passo === 4 ? navigate('/') : setPasso(passo + 1))}
          >
            {atual.cta}
          </Button>
          <Button variant="ghost" className="raiz-push" onClick={() => navigate('/')}>
            Pular para o painel
          </Button>
        </div>
      </Card>
    </>
  );
}
