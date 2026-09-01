import { ASSET_CLASS_COLORS, DATA_COLORS } from '@raiz/core';
import {
  Bar,
  Button,
  Card,
  CardBody,
  CardKicker,
  CardMeta,
  CardTitle,
  ChipPercentual,
  ConfirmDialog,
  Dialog,
  Donut,
  Dot,
  EmptyState,
  ErrorState,
  Field,
  FluxoChart,
  Input,
  Kpi,
  Money,
  MonthPicker,
  Monogram,
  PrivacyProvider,
  Segmented,
  Select,
  SkeletonCard,
  Table,
  Tag,
  TdNumero,
  Textarea,
  ThNumero,
} from '@raiz/ui';
import { useState } from 'react';

/**
 * Vitrine de todos os componentes do design system.
 *
 * Não é decoração: é como se confere, de uma olhada, que os componentes batem
 * com o Organic em todos os estados — incluindo os que raramente aparecem
 * (vazio, erro, estouro de orçamento, modo privacidade).
 */
export function KitchenSink() {
  const [mes, setMes] = useState('2026-08');
  const [filtro, setFiltro] = useState<'todos' | 'ENTRADA' | 'SAIDA'>('todos');
  const [dialogo, setDialogo] = useState(false);
  const [confirmacao, setConfirmacao] = useState(false);
  const [privacidade, setPrivacidade] = useState(false);

  return (
    <PrivacyProvider ativo={privacidade}>
      <div style={{ display: 'grid', gap: 'var(--space-6)' }}>
        <Secao titulo="Modo privacidade">
          <div className="raiz-row">
            <Button
              variant={privacidade ? 'primary' : 'secondary'}
              onClick={() => setPrivacidade((v) => !v)}
            >
              {privacidade ? 'Mostrar valores' : 'Ocultar valores'}
            </Button>
            <span style={{ fontSize: 13 }}>
              Saldo: <Money valor={21881.25} />
            </span>
          </div>
        </Secao>

        <Secao titulo="KPIs">
          <div className="raiz-grid raiz-grid-kpi">
            <Kpi rotulo="Saldo em contas" valor={21881.25} nota="3 contas conectadas" />
            <Kpi
              rotulo="Entradas do mês"
              valor={14400}
              corValor="var(--color-accent-2-700)"
              nota="2 salários + 1 freela"
            />
            <Kpi
              rotulo="Saídas do mês"
              valor={7783.7}
              corValor="var(--color-accent-700)"
              nota="R$ 380,10 são assinaturas"
            />
            <Kpi
              rotulo="Patrimônio total"
              valor={164681.25}
              decimals={0}
              fundo="var(--color-accent-900)"
              cor="var(--color-neutral-100)"
              nota="R$ 142.800 investidos"
            />
          </div>
        </Secao>

        <Secao titulo="Botões e etiquetas">
          <div className="raiz-row">
            <Button variant="primary">Novo lançamento</Button>
            <Button variant="secondary">Importar CSV/OFX</Button>
            <Button variant="ghost">Editar</Button>
            <Button variant="primary" disabled>
              Desabilitado
            </Button>
          </div>
          <div className="raiz-row" style={{ marginTop: 'var(--space-3)' }}>
            <Tag variant="accent">Atenção</Tag>
            <Tag variant="accent-2">Ativa</Tag>
            <Tag variant="neutral">recorrente</Tag>
            <Tag variant="outline">Teste grátis</Tag>
            <ChipPercentual pct="63%" />
            <ChipPercentual pct="183%" estourou />
          </div>
        </Secao>

        <Secao titulo="Seletor de mês e controle segmentado">
          <div className="raiz-row">
            <MonthPicker valor={mes} onChange={setMes} minimo="2026-03" maximo="2026-10" />
            <Segmented
              aria="Filtrar lançamentos por tipo"
              valor={filtro}
              onChange={setFiltro}
              opcoes={[
                { valor: 'todos', rotulo: 'Todos' },
                { valor: 'ENTRADA', rotulo: 'Entradas' },
                { valor: 'SAIDA', rotulo: 'Saídas' },
              ]}
            />
          </div>
          <CardMeta style={{ marginTop: 'var(--space-2)' }}>
            mês {mes} · filtro {filtro}
          </CardMeta>
        </Secao>

        <Secao titulo="Barras de orçamento">
          <div className="raiz-grid raiz-grid-card">
            <Card>
              <div className="raiz-row">
                <Dot cor="#d67f48" tamanho={26} />
                <CardTitle>Alimentação</CardTitle>
                <div className="raiz-push">
                  <ChipPercentual pct="63%" />
                </div>
              </div>
              <Bar pct={63} cor="#d67f48" altura={9} aria="63% do orçamento de Alimentação" />
              <CardMeta>
                <Money valor={947.6} /> usados · limite <Money valor={1500} decimals={0} />
              </CardMeta>
            </Card>
            <Card>
              <div className="raiz-row">
                <Dot cor="#b2622d" tamanho={26} />
                <CardTitle>Moradia</CardTitle>
                <div className="raiz-push">
                  <ChipPercentual pct="183%" estourou />
                </div>
              </div>
              <Bar
                pct={183}
                cor="#b2622d"
                altura={9}
                estourou
                aria="183% do orçamento de Moradia"
              />
              <CardMeta>
                <Money valor={4769.9} /> usados · limite <Money valor={2600} decimals={0} />
              </CardMeta>
            </Card>
            <Card>
              <div className="raiz-row">
                <Dot cor="#8fa073" tamanho={26} />
                <CardTitle>Saúde</CardTitle>
                <div className="raiz-push">
                  <ChipPercentual pct="105%" estourou />
                </div>
              </div>
              <Bar pct={105} cor="#8fa073" altura={9} estourou aria="105% do orçamento de Saúde" />
              <CardMeta>
                <Money valor={738.3} /> usados · limite <Money valor={700} decimals={0} />
              </CardMeta>
            </Card>
          </div>
        </Secao>

        <Secao titulo="Fluxo de caixa">
          <Card>
            <CardKicker>Entradas e saídas</CardKicker>
            <FluxoChart
              colunas={[
                { rotulo: 'Mar', entradas: 12600, saidas: 8120 },
                { rotulo: 'Abr', entradas: 12600, saidas: 9040 },
                { rotulo: 'Mai', entradas: 13100, saidas: 7860 },
                { rotulo: 'Jun', entradas: 12600, saidas: 8740 },
                { rotulo: 'Jul', entradas: 14200, saidas: 9310 },
                { rotulo: 'Ago', entradas: 14400, saidas: 8100 },
                { rotulo: 'Set', entradas: 12600, saidas: 8600, previsto: true },
                { rotulo: 'Out', entradas: 12600, saidas: 8950, previsto: true },
              ]}
            />
          </Card>
        </Secao>

        <Secao titulo="Donut de alocação">
          <Card>
            <div className="raiz-row" style={{ gap: 'var(--space-6)' }}>
              <Donut
                fatias={[
                  { classe: 'Renda fixa', valor: 60500 },
                  { classe: 'Fundos imobiliários', valor: 26300 },
                  { classe: 'Ações exterior', valor: 31700 },
                  { classe: 'Ações Brasil', valor: 14900 },
                  { classe: 'Cripto', valor: 9400 },
                ]}
                centro={
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--color-neutral-700)' }}>Investido</div>
                    <Money
                      valor={142800}
                      decimals={0}
                      style={{ fontFamily: 'var(--font-heading)', fontSize: 17 }}
                    />
                  </div>
                }
              />
              <div style={{ display: 'grid', gap: 6 }}>
                {Object.entries(ASSET_CLASS_COLORS).map(([classe, cor]) => (
                  <span
                    key={classe}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13 }}
                  >
                    <Dot cor={cor} tamanho={12} />
                    {classe}
                  </span>
                ))}
              </div>
            </div>
          </Card>
        </Secao>

        <Secao titulo="Monogramas e cores de dados">
          <div className="raiz-row">
            <Monogram texto="N" />
            <Monogram texto="I" fundo="var(--color-accent-2-200)" cor="var(--color-accent-2-900)" />
            <Monogram texto="08" tamanho={40} />
            <Monogram
              texto="R"
              tamanho={36}
              fundo="var(--color-neutral-200)"
              cor="var(--color-neutral-800)"
            />
          </div>
          <div className="raiz-row" style={{ marginTop: 'var(--space-3)' }}>
            {DATA_COLORS.map((cor) => (
              <Dot key={cor} cor={cor} tamanho={20} />
            ))}
          </div>
        </Secao>

        <Secao titulo="Tabela">
          <Card>
            <Table aria="Lançamentos de exemplo">
              <thead>
                <tr>
                  <th scope="col">Data</th>
                  <th scope="col">Descrição</th>
                  <th scope="col">Categoria</th>
                  <ThNumero>Valor</ThNumero>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>01/08</td>
                  <td>
                    Salário Ana <Tag variant="neutral">recorrente</Tag>
                  </td>
                  <td>
                    <span className="raiz-row">
                      <Dot cor="#56633f" /> Salário
                    </span>
                  </td>
                  <TdNumero style={{ fontWeight: 600, color: 'var(--color-accent-2-700)' }}>
                    <Money valor={7400} sinal="ENTRADA" />
                  </TdNumero>
                </tr>
                <tr>
                  <td>05/08</td>
                  <td>Aluguel</td>
                  <td>
                    <span className="raiz-row">
                      <Dot cor="#b2622d" /> Moradia
                    </span>
                  </td>
                  <TdNumero style={{ fontWeight: 600 }}>
                    <Money valor={2200} sinal="SAIDA" />
                  </TdNumero>
                </tr>
              </tbody>
            </Table>
          </Card>
        </Secao>

        <Secao titulo="Formulário">
          <Card>
            <div className="raiz-form-grid">
              <Field label="Descrição" largo>
                {(p) => <Input {...p} placeholder="Supermercado" />}
              </Field>
              <Field label="Valor" dica="Aceita 1.234,56">
                {(p) => <Input {...p} inputMode="decimal" placeholder="0,00" />}
              </Field>
              <Field label="Prazo em meses" erro="O prazo precisa ser de pelo menos 1 mês.">
                {(p) => <Input {...p} defaultValue="0" />}
              </Field>
              <Field label="Categoria">
                {(p) => (
                  <Select {...p} defaultValue="Alimentação">
                    <option>Alimentação</option>
                    <option>Moradia</option>
                  </Select>
                )}
              </Field>
              <Field label="Observação" largo>
                {(p) => <Textarea {...p} rows={3} />}
              </Field>
            </div>
          </Card>
        </Secao>

        <Secao titulo="Diálogos">
          <div className="raiz-row">
            <Button variant="primary" onClick={() => setDialogo(true)}>
              Abrir diálogo
            </Button>
            <Button variant="secondary" onClick={() => setConfirmacao(true)}>
              Abrir confirmação
            </Button>
          </div>
          <Dialog
            aberto={dialogo}
            titulo="Novo lançamento"
            onFechar={() => setDialogo(false)}
            acoes={
              <>
                <Button variant="secondary" onClick={() => setDialogo(false)}>
                  Cancelar
                </Button>
                <Button variant="primary" onClick={() => setDialogo(false)}>
                  Salvar
                </Button>
              </>
            }
          >
            <div className="raiz-form-grid">
              <Field label="Descrição" largo>
                {(p) => <Input {...p} autoFocus />}
              </Field>
              <Field label="Valor">{(p) => <Input {...p} inputMode="decimal" />}</Field>
              <Field label="Data">{(p) => <Input {...p} type="date" />}</Field>
            </div>
          </Dialog>
          <ConfirmDialog
            aberto={confirmacao}
            titulo="Excluir lançamento?"
            descricao="Esta ação não pode ser desfeita."
            rotuloConfirmar="Excluir"
            onConfirmar={() => setConfirmacao(false)}
            onCancelar={() => setConfirmacao(false)}
          />
        </Secao>

        <Secao titulo="Estados">
          <div className="raiz-grid raiz-grid-panel">
            <SkeletonCard />
            <EmptyState
              titulo="Nenhum lançamento em agosto"
              descricao="Importe um extrato ou registre o primeiro lançamento do mês."
              acao={<Button variant="primary">Novo lançamento</Button>}
            />
            <ErrorState onTentarNovamente={() => undefined} />
          </div>
        </Secao>

        <Secao titulo="Card com kicker, título, corpo e meta">
          <div className="raiz-grid raiz-grid-card">
            <Card elevacao="sm">
              <CardKicker>Assinatura</CardKicker>
              <CardTitle>Streaming de vídeo</CardTitle>
              <CardBody>Plano família · debita no Nubank Ultravioleta</CardBody>
              <CardMeta>próximo débito 05/09</CardMeta>
            </Card>
          </div>
        </Secao>
      </div>
    </PrivacyProvider>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 style={{ marginBottom: 'var(--space-3)' }}>{titulo}</h3>
      {children}
    </section>
  );
}
