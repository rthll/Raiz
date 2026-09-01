import { formatBRL, formatPercent } from '@raiz/core';
import {
  Button,
  Card,
  CardKicker,
  CardMeta,
  Dot,
  EmptyState,
  ErrorState,
  Money,
  SkeletonCard,
  Table,
  TdNumero,
  ThNumero,
} from '@raiz/ui';
import { useEffect, useState } from 'react';
import { useCartoes, useCategorias, useFatura, usePagarFatura } from '../api/hooks.js';
import type { Cartao } from '../api/types.js';
import { CartaoDialog } from '../dialogs/CartaoDialog.js';
import { useCrud } from '../dialogs/useCrud.js';
import { useCompetencia } from '../state/competencia.js';
import { TelaHeader } from '../shell/TelaHeader.js';

const diaMes = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export function Cartoes() {
  const { mes } = useCompetencia();
  const cartoes = useCartoes();
  const [selecionado, setSelecionado] = useState<string | undefined>();
  const pagar = usePagarFatura();

  // O primeiro cartão vem selecionado; se ele for excluído, cai no próximo.
  useEffect(() => {
    if (!cartoes.data?.length) return;
    if (!selecionado || !cartoes.data.some((c) => c.id === selecionado)) {
      setSelecionado(cartoes.data[0]!.id);
    }
  }, [cartoes.data, selecionado]);

  const crud = useCrud<Cartao>('cards', { singular: 'Cartão', artigo: 'o' });

  const fatura = useFatura(selecionado, mes);
  const categorias = useCategorias();

  const totalFaturas = cartoes.data?.length ?? 0;
  const limiteTotal = cartoes.data?.reduce((a, c) => a + c.limite, 0) ?? 0;

  return (
    <>
      <TelaHeader
        acoes={
          <Button variant="primary" onClick={crud.abrirNovo}>
            Cadastrar cartão
          </Button>
        }
      />

      {cartoes.data && cartoes.data.length > 0 && (
        <CardMeta style={{ marginBottom: 'var(--space-3)' }}>
          {totalFaturas} cartõe{totalFaturas === 1 ? '' : 's'} ·{' '}
          {formatBRL(limiteTotal, { decimals: 0 })} de limite somado
        </CardMeta>
      )}

      {cartoes.isError && <ErrorState onTentarNovamente={() => void cartoes.refetch()} />}

      {cartoes.isPending && (
        <div className="raiz-grid raiz-grid-card">
          {Array.from({ length: 3 }, (_, i) => (
            <SkeletonCard key={i} linhas={4} />
          ))}
        </div>
      )}

      {cartoes.data?.length === 0 && (
        <EmptyState
          titulo="Nenhum cartão cadastrado"
          descricao="Informe limite, fechamento e vencimento para o Raiz montar a fatura."
          acao={
            <Button variant="primary" onClick={crud.abrirNovo}>
              Cadastrar cartão
            </Button>
          }
        />
      )}

      {cartoes.data && cartoes.data.length > 0 && (
        <div className="raiz-grid raiz-grid-card" style={{ marginBottom: 'var(--space-4)' }}>
          {cartoes.data.map((cartao) => (
            <CartaoBotao
              key={cartao.id}
              cartao={cartao}
              selecionado={cartao.id === selecionado}
              onSelect={() => setSelecionado(cartao.id)}
              mes={mes}
            />
          ))}
        </div>
      )}

      {fatura.isPending && selecionado && <SkeletonCard linhas={5} />}

      {fatura.data && (
        // Região nomeada: quem usa leitor de tela pula direto para a fatura,
        // e o total deixa de ser ambíguo com o valor mostrado no cartão.
        <Card role="region" aria-label={`Fatura de ${fatura.data.cartao.nome}`}>
          <div className="raiz-row" style={{ alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0 }}>
              <CardKicker>Fatura de {mes}</CardKicker>
              <h4 style={{ margin: '2px 0' }}>
                {fatura.data.cartao.nome} · •••• {fatura.data.cartao.final}
              </h4>
              <CardMeta>
                Fecha em {diaMes(fatura.data.fechamento)} e vence em{' '}
                {diaMes(fatura.data.vencimento)} · limite de{' '}
                {formatBRL(fatura.data.limite, { decimals: 0 })}
              </CardMeta>
            </div>
            <div className="raiz-push" style={{ textAlign: 'right' }}>
              <Money
                valor={fatura.data.total}
                style={{ fontFamily: 'var(--font-heading)', fontSize: 23, display: 'block' }}
              />
              <div className="raiz-row" style={{ justifyContent: 'flex-end' }}>
                <Button variant="secondary" onClick={() => crud.abrirEdicao(fatura.data.cartao)}>
                  Editar cartão
                </Button>
                <Button
                  variant={fatura.data.paga ? 'secondary' : 'primary'}
                  disabled={pagar.isPending}
                  onClick={() => pagar.mutate({ cardId: fatura.data.cartao.id, mes })}
                >
                  {fatura.data.paga ? 'Fatura paga' : 'Marcar como paga'}
                </Button>
              </div>
            </div>
          </div>

          {fatura.data.itens.length === 0 ? (
            <CardMeta>Nenhum lançamento neste cartão no mês.</CardMeta>
          ) : (
            <Table aria={`Fatura do ${fatura.data.cartao.nome}`}>
              <thead>
                <tr>
                  <th scope="col">Data</th>
                  <th scope="col">Lançamento</th>
                  <th scope="col">Categoria</th>
                  <th scope="col">Parcela</th>
                  <ThNumero>Valor</ThNumero>
                </tr>
              </thead>
              <tbody>
                {fatura.data.itens.map((item) => {
                  const categoria = categorias.data?.find((c) => c.id === item.categoriaId);
                  return (
                    <tr key={item.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{diaMes(item.data)}</td>
                      <td>{item.descricao}</td>
                      <td>
                        <span className="raiz-row">
                          <Dot cor={categoria?.cor ?? 'var(--color-neutral-500)'} />
                          {categoria?.nome ?? '—'}
                        </span>
                      </td>
                      <td>
                        {item.parcelaTotal ? `${item.parcelaAtual}/${item.parcelaTotal}` : '—'}
                      </td>
                      <TdNumero>
                        <Money valor={item.valor} />
                      </TdNumero>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}

          <CardMeta>
            {fatura.data.assinaturasVinculadas.quantidade} assinaturas debitam neste cartão (
            {formatBRL(fatura.data.assinaturasVinculadas.custoMensal)}/mês)
            {fatura.data.parcelasEmAndamento > 0 &&
              ` · ${fatura.data.parcelasEmAndamento} compra parcelada em andamento`}
          </CardMeta>
        </Card>
      )}

      <CartaoDialog aberto={crud.dialogoAberto} editando={crud.editando} onFechar={crud.fechar} />
      {crud.confirmacao}
    </>
  );
}

function CartaoBotao({
  cartao,
  selecionado,
  onSelect,
  mes,
}: {
  cartao: Cartao;
  selecionado: boolean;
  onSelect: () => void;
  mes: string;
}) {
  const fatura = useFatura(cartao.id, mes);
  const total = fatura.data?.total ?? 0;
  const uso = cartao.limite > 0 ? (total / cartao.limite) * 100 : 0;

  return (
    <button
      type="button"
      onClick={onSelect}
      // aria-pressed comunica o estado de seleção para quem usa leitor de tela;
      // a borda de 2px sozinha só serve para quem enxerga.
      aria-pressed={selecionado}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
        minHeight: 178,
        textAlign: 'left',
        padding: 'var(--space-4)',
        borderRadius: 'calc(var(--radius-lg) * 1.15)',
        cursor: 'pointer',
        fontFamily: 'var(--font-body)',
        background: cartao.temaEscuro ? 'var(--color-accent-900)' : 'var(--color-surface)',
        color: cartao.temaEscuro ? 'var(--color-neutral-100)' : 'var(--color-text)',
        border: `2px solid ${selecionado ? 'var(--color-accent)' : 'transparent'}`,
        boxShadow: selecionado ? 'var(--shadow-md)' : 'none',
      }}
    >
      <div className="raiz-row" style={{ width: '100%' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 18 }}>{cartao.nome}</div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            {cartao.bandeira.toLowerCase()} · •••• {cartao.final}
          </div>
        </div>
        <span
          aria-hidden="true"
          className="raiz-push"
          style={{
            width: 26,
            height: 26,
            borderRadius: 999,
            background: 'currentColor',
            opacity: 0.25,
            flex: 'none',
          }}
        />
      </div>

      <div style={{ marginTop: 'auto', width: '100%' }}>
        <div className="raiz-row" style={{ marginBottom: 6 }}>
          <span style={{ fontSize: 12, opacity: 0.8 }}>fatura aberta</span>
          <span className="raiz-push" style={{ fontWeight: 600 }}>
            <Money valor={total} />
          </span>
        </div>
        <div
          style={{
            height: 7,
            borderRadius: 999,
            background: 'color-mix(in srgb, currentColor 20%, transparent)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${Math.max(3, Math.min(100, uso))}%`,
              height: '100%',
              borderRadius: 999,
              background: cartao.temaEscuro ? 'var(--color-accent-300)' : 'var(--color-accent)',
            }}
          />
        </div>
        <div style={{ fontSize: 11, opacity: 0.75, marginTop: 6 }}>
          limite {formatBRL(cartao.limite, { decimals: 0 })} · fecha dia {cartao.diaFechamento} ·
          vence dia {cartao.diaVencimento} · {formatPercent(uso)} usado
        </div>
      </div>
    </button>
  );
}
