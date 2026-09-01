import {
  ASSET_CLASS_COLORS,
  MILESTONE_YEARS,
  assetClassColor,
  formatBRL,
  formatPercent,
  portfolioProjection,
} from '@raiz/core';
import {
  Button,
  Card,
  CardKicker,
  CardMeta,
  Donut,
  Dot,
  EmptyState,
  ErrorState,
  Money,
  SkeletonCard,
  Table,
  Tag,
  TdNumero,
  ThNumero,
} from '@raiz/ui';
import { useMemo, useState } from 'react';
import { useAtivos } from '../api/hooks.js';
import type { Ativo, ClasseAtivo } from '../api/types.js';
import { AtivoDialog } from '../dialogs/AtivoDialog.js';
import { useCrud } from '../dialogs/useCrud.js';
import { TelaHeader } from '../shell/TelaHeader.js';

/** Nome legível de cada classe. O enum do banco é SCREAMING_SNAKE. */
const ROTULO_CLASSE: Record<ClasseAtivo, string> = {
  RENDA_FIXA: 'Renda fixa',
  FUNDOS_IMOBILIARIOS: 'Fundos imobiliários',
  ACOES_EXTERIOR: 'Ações exterior',
  ACOES_BRASIL: 'Ações Brasil',
  CRIPTO: 'Cripto',
};

export function Investimentos() {
  const ativos = useAtivos();
  const [anos, setAnos] = useState(10);
  const [ajusteTaxa, setAjusteTaxa] = useState(0);
  const [aporteExtra, setAporteExtra] = useState(0);
  const crud = useCrud<Ativo>('assets', { singular: 'Ativo', artigo: 'o' });

  /**
   * A projeção é calculada **local**, com a mesma `@raiz/core` que a API usa.
   *
   * É o que faz os três sliders responderem no mesmo quadro em que o usuário
   * arrasta. Um round-trip por pixel arrastado seria lento e inútil: a fórmula
   * é determinística e já está testada por paridade contra o protótipo.
   */
  const projecao = useMemo(() => {
    const entrada = (ativos.data ?? []).map((a) => ({
      valor: a.valor,
      taxa: a.taxaAnual,
      aporteMensal: a.aporteMensal,
    }));
    return portfolioProjection(entrada, anos, { ajusteTaxa, aporteExtra });
  }, [ativos.data, anos, ajusteTaxa, aporteExtra]);

  const alocacao = useMemo(() => {
    const porClasse = new Map<string, number>();
    for (const a of ativos.data ?? []) {
      const nome = ROTULO_CLASSE[a.classe];
      porClasse.set(nome, (porClasse.get(nome) ?? 0) + a.valor);
    }
    return [...porClasse.entries()].map(([classe, valor]) => ({ classe, valor }));
  }, [ativos.data]);

  const investido = projecao.total > 0 ? (ativos.data ?? []).reduce((a, x) => a + x.valor, 0) : 0;
  const maiorMarco = Math.max(1, ...projecao.marcos.map((m) => m.total));

  if (ativos.isError) {
    return (
      <>
        <TelaHeader />
        <ErrorState onTentarNovamente={() => void ativos.refetch()} />
      </>
    );
  }

  if (ativos.isPending) {
    return (
      <>
        <TelaHeader />
        <div className="raiz-grid raiz-grid-panel">
          <SkeletonCard linhas={5} />
          <SkeletonCard linhas={5} />
        </div>
      </>
    );
  }

  if (!ativos.data || ativos.data.length === 0) {
    return (
      <>
        <TelaHeader
          acoes={
            <Button variant="primary" onClick={crud.abrirNovo}>
              Adicionar ativo
            </Button>
          }
        />
        <EmptyState
          titulo="Nenhum ativo cadastrado"
          descricao="Ativos com taxa de retorno alimentam as projeções de patrimônio."
          acao={
            <Button variant="primary" onClick={crud.abrirNovo}>
              Adicionar ativo
            </Button>
          }
        />
      </>
    );
  }

  return (
    <>
      <TelaHeader
        semMes
        acoes={
          <Button variant="primary" onClick={crud.abrirNovo}>
            Adicionar ativo
          </Button>
        }
      />

      <CardMeta style={{ marginBottom: 'var(--space-3)' }}>
        {ativos.data.length} ativos · aporte mensal de{' '}
        {formatBRL(projecao.aporteMensalTotal - aporteExtra, { decimals: 0 })} · taxa média
        ponderada de {formatPercent(projecao.taxaMediaPonderada, 1)} a.a.
      </CardMeta>

      <div className="raiz-grid raiz-grid-panel" style={{ marginBottom: 'var(--space-3)' }}>
        <Card>
          <CardKicker>Alocação</CardKicker>
          <div className="raiz-row" style={{ gap: 'var(--space-6)' }}>
            <Donut
              fatias={alocacao}
              centro={
                <div>
                  <div style={{ fontSize: 11, color: 'var(--color-neutral-700)' }}>Investido</div>
                  <Money
                    valor={investido}
                    decimals={0}
                    style={{ fontFamily: 'var(--font-heading)', fontSize: 17 }}
                  />
                </div>
              }
            />
            <div style={{ display: 'grid', gap: 8 }}>
              {alocacao.map((f) => (
                <span
                  key={f.classe}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13 }}
                >
                  <Dot cor={assetClassColor(f.classe)} tamanho={12} />
                  {f.classe}
                  <span style={{ color: 'var(--color-neutral-600)' }}>
                    {formatPercent(investido > 0 ? (f.valor / investido) * 100 : 0)}
                  </span>
                </span>
              ))}
            </div>
          </div>
        </Card>

        <Simulador
          anos={anos}
          ajusteTaxa={ajusteTaxa}
          aporteExtra={aporteExtra}
          setAnos={setAnos}
          setAjusteTaxa={setAjusteTaxa}
          setAporteExtra={setAporteExtra}
          projecao={projecao}
        />
      </div>

      <Card
        role="group"
        aria-label="Provisão futura por marco"
        style={{ marginBottom: 'var(--space-3)' }}
      >
        <CardKicker>Provisão futura por marco</CardKicker>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 'var(--space-4)',
            minHeight: 160,
            overflowX: 'auto',
          }}
        >
          {projecao.marcos.map((marco) => (
            <div
              key={marco.anos}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                flex: '1 1 0',
                minWidth: 70,
              }}
            >
              <span style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                {formatBRL(marco.total, { decimals: 0 })}
              </span>
              <div
                style={{
                  width: '100%',
                  maxWidth: 76,
                  height: Math.max(8, (marco.total / maiorMarco) * 118),
                  borderRadius: 'var(--radius-md) var(--radius-md) 6px 6px',
                  // O marco do prazo escolhido no simulador fica destacado.
                  background:
                    marco.anos === anos ? 'var(--color-accent)' : 'var(--color-accent-300)',
                }}
              />
              <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>
                {marco.anos} {marco.anos === 1 ? 'ano' : 'anos'}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <Table aria="Ativos da carteira">
          <thead>
            <tr>
              <th scope="col">Ativo</th>
              <th scope="col">Classe</th>
              <ThNumero>Valor atual</ThNumero>
              <ThNumero>Taxa a.a.</ThNumero>
              <ThNumero>Aporte mensal</ThNumero>
              <th scope="col">Meta</th>
              <ThNumero>Em {anos} anos</ThNumero>
              <th scope="col">
                <span className="raiz-sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {ativos.data.map((ativo, i) => {
              const bateMeta = ativo.taxaAnual >= ativo.metaTaxa;
              return (
                <tr key={ativo.id}>
                  <td>{ativo.nome}</td>
                  <td>
                    <span className="raiz-row">
                      <Dot cor={assetClassColor(ROTULO_CLASSE[ativo.classe])} />
                      {ROTULO_CLASSE[ativo.classe]}
                    </span>
                  </td>
                  <TdNumero>
                    <Money valor={ativo.valor} decimals={0} />
                  </TdNumero>
                  <TdNumero>{formatPercent(ativo.taxaAnual, 1)}</TdNumero>
                  <TdNumero>
                    <Money valor={ativo.aporteMensal} decimals={0} />
                  </TdNumero>
                  <td>
                    <Tag variant={bateMeta ? 'accent-2' : 'accent'}>
                      {bateMeta ? 'acima' : 'abaixo'} de {formatPercent(ativo.metaTaxa, 1)}
                    </Tag>
                  </td>
                  <TdNumero>
                    <Money valor={projecao.porAtivo[i]?.total ?? 0} decimals={0} />
                  </TdNumero>
                  <td>
                    <span className="raiz-row" style={{ flexWrap: 'nowrap' }}>
                      <Button variant="ghost" onClick={() => crud.abrirEdicao(ativo)}>
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        style={{ color: 'var(--color-neutral-700)' }}
                        onClick={() => crud.pedirExclusao(ativo)}
                      >
                        Excluir
                      </Button>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>

      <AtivoDialog aberto={crud.dialogoAberto} editando={crud.editando} onFechar={crud.fechar} />
      {crud.confirmacao}
    </>
  );
}

function Simulador({
  anos,
  ajusteTaxa,
  aporteExtra,
  setAnos,
  setAjusteTaxa,
  setAporteExtra,
  projecao,
}: {
  anos: number;
  ajusteTaxa: number;
  aporteExtra: number;
  setAnos: (v: number) => void;
  setAjusteTaxa: (v: number) => void;
  setAporteExtra: (v: number) => void;
  projecao: ReturnType<typeof portfolioProjection>;
}) {
  return (
    <Card
      role="group"
      aria-label="Simulador de cenários"
      fundo="var(--color-accent-900)"
      cor="var(--color-neutral-100)"
    >
      <CardKicker style={{ color: 'var(--color-accent-300)' }}>Simulador de cenários</CardKicker>
      <Money
        valor={projecao.total}
        decimals={0}
        style={{ fontFamily: 'var(--font-heading)', fontSize: 32, lineHeight: 1.1 }}
      />
      <div style={{ fontSize: 12, opacity: 0.85 }}>
        em {anos} {anos === 1 ? 'ano' : 'anos'} · aporte mensal de{' '}
        {formatBRL(projecao.aporteMensalTotal, { decimals: 0 })} · taxa média{' '}
        {formatPercent(projecao.taxaSimulada, 1)} a.a.
      </div>

      <Slider
        rotulo="Prazo"
        valor={`${anos} ${anos === 1 ? 'ano' : 'anos'}`}
        min={1}
        max={30}
        step={1}
        value={anos}
        onChange={setAnos}
      />
      <Slider
        rotulo="Ajuste de taxa"
        valor={`${ajusteTaxa > 0 ? '+' : ''}${String(ajusteTaxa).replace('.', ',')} p.p.`}
        min={-3}
        max={4}
        step={0.5}
        value={ajusteTaxa}
        onChange={setAjusteTaxa}
      />
      <Slider
        rotulo="Aporte extra"
        valor={formatBRL(aporteExtra, { decimals: 0 })}
        min={0}
        max={3000}
        step={100}
        value={aporteExtra}
        onChange={setAporteExtra}
      />

      <div style={{ fontSize: 12, opacity: 0.85 }}>
        Do total projetado, {formatBRL(projecao.juros, { decimals: 0 })} vêm de juros e{' '}
        {formatBRL(projecao.totalAportado, { decimals: 0 })} do que você aporta.
      </div>
    </Card>
  );
}

function Slider({
  rotulo,
  valor,
  min,
  max,
  step,
  value,
  onChange,
}: {
  rotulo: string;
  valor: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label style={{ display: 'block', fontSize: 12 }}>
      <span className="raiz-row" style={{ marginBottom: 4 }}>
        {rotulo}
        <span className="raiz-push" style={{ opacity: 0.85 }}>
          {valor}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        // aria-valuetext para o leitor de tela ler "10 anos", não só "10".
        aria-valuetext={valor}
        style={{ width: '100%', accentColor: 'var(--color-accent)' }}
      />
    </label>
  );
}

export { ASSET_CLASS_COLORS, MILESTONE_YEARS };
