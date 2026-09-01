import { formatBRL, formatPercent, monthlyCost } from '@raiz/core';
import {
  Button,
  Card,
  CardMeta,
  CardTitle,
  EmptyState,
  ErrorState,
  Kpi,
  Money,
  Monogram,
  SkeletonCard,
  Tag,
} from '@raiz/ui';
import {
  useAlternarAssinatura,
  useAssinaturas,
  useCartoes,
  useCategorias,
  useResumoAssinaturas,
} from '../api/hooks.js';
import type { StatusAssinatura } from '../api/types.js';
import { useCompetencia } from '../state/competencia.js';
import { TelaHeader } from '../shell/TelaHeader.js';

const ROTULO_STATUS: Record<StatusAssinatura, string> = {
  ATIVA: 'Ativa',
  PAUSADA: 'Pausada',
  TESTE: 'Teste grátis',
};

const ROTULO_PERIODO = {
  MENSAL: 'mensal',
  TRIMESTRAL: 'trimestral',
  SEMESTRAL: 'semestral',
  ANUAL: 'anual',
} as const;

const diaMes = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export function Assinaturas() {
  const { mes } = useCompetencia();
  const assinaturas = useAssinaturas();
  const resumo = useResumoAssinaturas(mes);
  const cartoes = useCartoes();
  const categorias = useCategorias();
  const alternar = useAlternarAssinatura();

  const nomeCartao = (id: string | null) =>
    cartoes.data?.find((c) => c.id === id)?.nome ?? 'sem cartão';
  const nomeCategoria = (id: string) => categorias.data?.find((c) => c.id === id)?.nome ?? '—';

  return (
    <>
      <TelaHeader acoes={<Button variant="primary">Nova assinatura</Button>} />

      {resumo.data && (
        <div className="raiz-grid raiz-grid-kpi" style={{ marginBottom: 'var(--space-3)' }}>
          <Kpi rotulo="Custo mensal" valor={resumo.data.custoMensal} nota="já mensalizado" />
          <Kpi
            rotulo="Custo anual"
            valor={resumo.data.custoAnual}
            decimals={0}
            nota="mensal × 12"
          />
          <Kpi
            rotulo="Ativas / pausadas"
            valor={resumo.data.ativas}
            decimals={0}
            nota={`${resumo.data.pausadas} pausada${resumo.data.pausadas === 1 ? '' : 's'}`}
          />
          <Kpi
            rotulo="% da renda"
            valor={resumo.data.pctRenda}
            decimals={0}
            fundo="var(--color-accent-200)"
            nota={
              resumo.data.maisCara
                ? `a mais cara é ${resumo.data.maisCara.nome}`
                : 'sem assinaturas ativas'
            }
          />
        </div>
      )}

      {resumo.data && (
        <CardMeta style={{ marginBottom: 'var(--space-3)' }}>
          {formatPercent(resumo.data.pctRenda, 1)} da renda do mês · assinaturas anuais aparecem
          divididas por 12
        </CardMeta>
      )}

      {assinaturas.isError && <ErrorState onTentarNovamente={() => void assinaturas.refetch()} />}

      {assinaturas.isPending && (
        <div className="raiz-grid raiz-grid-card">
          {Array.from({ length: 6 }, (_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {assinaturas.data?.length === 0 && (
        <EmptyState
          titulo="Nenhuma assinatura cadastrada"
          descricao="Assinaturas viram previsão de saída e alimentam o alerta de teste grátis."
          acao={<Button variant="primary">Nova assinatura</Button>}
        />
      )}

      {assinaturas.data && assinaturas.data.length > 0 && (
        <div className="raiz-grid raiz-grid-card-wide">
          {assinaturas.data.map((a) => {
            const pausada = a.status === 'PAUSADA';
            const mensal = monthlyCost({ valor: a.valor, periodo: a.periodo });

            return (
              <Card key={a.id} style={{ opacity: pausada ? 0.75 : 1 }}>
                <div className="raiz-row">
                  <Monogram
                    texto={a.nome.charAt(0)}
                    fundo={pausada ? 'var(--color-neutral-200)' : 'var(--color-accent-200)'}
                    cor={pausada ? 'var(--color-neutral-700)' : 'var(--color-accent-900)'}
                  />
                  <div style={{ minWidth: 0 }}>
                    <CardTitle>{a.nome}</CardTitle>
                    <CardMeta>
                      {nomeCategoria(a.categoriaId)} · {nomeCartao(a.cardId)}
                    </CardMeta>
                  </div>
                  <div className="raiz-push">
                    <Tag
                      variant={
                        pausada ? 'neutral' : a.status === 'TESTE' ? 'accent' : 'accent-2'
                      }
                    >
                      {ROTULO_STATUS[a.status]}
                    </Tag>
                  </div>
                </div>

                <div className="raiz-row" style={{ gap: 6 }}>
                  <Money
                    valor={a.valor}
                    style={{ fontFamily: 'var(--font-heading)', fontSize: 22 }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}>
                    / {ROTULO_PERIODO[a.periodo]}
                  </span>
                </div>

                <CardMeta>
                  Equivale a {formatBRL(mensal)} por mês · próximo débito{' '}
                  {diaMes(a.proximoDebito)}
                </CardMeta>

                {a.observacao && (
                  <div
                    style={{
                      background: 'var(--color-accent-200)',
                      color: 'var(--color-accent-900)',
                      borderRadius: 'var(--radius-md)',
                      padding: 'var(--space-2) var(--space-3)',
                      fontSize: 12,
                    }}
                  >
                    {a.observacao}
                  </div>
                )}

                <div className="raiz-row">
                  <Button variant="secondary">Editar</Button>
                  <Button
                    variant="secondary"
                    disabled={alternar.isPending}
                    onClick={() => alternar.mutate(a.id)}
                  >
                    {pausada ? 'Reativar' : 'Pausar'}
                  </Button>
                  <Button variant="ghost" style={{ color: 'var(--color-neutral-700)' }}>
                    Excluir
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
