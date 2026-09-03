# QA contra os screenshots

Conferência visual das 10 telas e do diálogo, comparando com
`Sistema de gerenciamento financeiro/design_handoff_raiz_financas/screenshots/`.

Suba o sistema, entre com `ana@raiz.app` / `raiz1234` e vá tela a tela com o
screenshot ao lado. Os números abaixo **já são conferidos por teste automatizado**
— estão aqui para você bater o olho e confirmar que chegaram na tela certa, no
lugar certo. O que os testes **não** cobrem, e é o que realmente importa aqui,
está marcado com 👁: cor, espaçamento, tipografia e peso visual.

```bash
pnpm dev
# antes, se tiver mexido nos dados:
pnpm --filter @raiz/api db:seed
```

---

## 01 · Visão geral

| Conferir | Esperado |
| --- | --- |
| Saldo em contas | R$ 21.881,25 |
| Entradas do mês | R$ 14.400,00, em sálvia (`--color-accent-2-700`) |
| Saídas do mês | R$ 7.783,70, em terracota (`--color-accent-700`) |
| Patrimônio total | R$ 164.681 — card escuro, texto claro |
| Banner de atenção | "App de meditação sai do teste grátis em 06/09 … fatura do Nubank Ultravioleta fecha no dia 28" |
| Maior categoria | Moradia, R$ 4.769,90 |
| Divisão do casal | "Bruno transfere … para Ana" |

👁 Valor do KPI em **Caprasimo 27px**. Fluxo de caixa com barras de 18px, meses
futuros esmaecidos e rótulo em itálico. Pílula do vencimento em 40px.

## 02 · Lançamentos

| Conferir | Esperado |
| --- | --- |
| Resumo | "17 de 17 lançamentos · saldo do mês R$ 6.616,30" |
| Colunas | Data, Descrição, Categoria, Conta/cartão, Responsável, Valor |
| Entradas | `+ R$ 7.400,00` em sálvia |
| Saídas | `– R$ 2.200,00` em preto, peso 600 |
| Etiquetas | "recorrente" no Salário Ana; "3/10" no Notebook |
| Filtro | Saídas → 14 itens; busca "supermercado" → 1 |

👁 Dot colorido antes do nome da categoria. Valores alinhados à direita.

## 03 · Categorias

| Conferir | Esperado |
| --- | --- |
| Resumo | "8 categorias · R$ 6.980 de limite somado, R$ 7.784 usados" |
| Moradia | chip **183%** em terracota, barra em `#8c491a` |
| Saúde | chip **105%** em terracota — o estouro sutil |
| Alimentação | chip **63%** em sálvia |
| Salário | "sem limite", não zero |
| Regras | SUPERMERC → Alimentação, 14 lançamentos |

👁 Dot de 26px. O chip de estouro inverte para o par accent-200/800.

## 04 · Assinaturas

| Conferir | Esperado |
| --- | --- |
| Custo mensal | R$ 380,10 |
| Custo anual | R$ 4.561 |
| Ativas / pausadas | 7 / 1 |
| % da renda | 3% (card em `--color-accent-200`) |
| Suíte de design | "Equivale a R$ 107,50 por mês" — anual dividida por 12 |
| Jornal digital | etiqueta "Pausada", card esmaecido |
| App de meditação | etiqueta "Teste grátis" |

👁 Monograma de 38px com a inicial. Valor em Caprasimo 22px seguido de "/ mensal".

## 05 · Cartões e faturas

| Conferir | Esperado |
| --- | --- |
| Nubank Ultravioleta | card **escuro**, selecionado por padrão, fatura R$ 1.910,20 |
| Itaú Click | R$ 702,80 |
| Inter Gold | R$ 0,00, "Nenhum lançamento neste cartão no mês" |
| Cabeçalho da fatura | "Fecha em 28/08 e vence em 08/09 · limite de R$ 12.000" |
| Rodapé | "4 assinaturas debitam neste cartão … 1 compra parcelada" |
| Clicar em outro cartão | troca a fatura sem recarregar |

👁 Borda de 2px em accent no selecionado, com sombra; os outros sem borda visível.
Círculo decorativo de 26px a 25% de opacidade.

## 06 · Investimentos

| Conferir | Esperado |
| --- | --- |
| Investido (centro do donut) | R$ 142.800 |
| Projeção padrão (10 anos) | **R$ 772.500** |
| Taxa média | 11,0% a.a. |
| Marcos | 1, 3, 5, 10 e 20 anos — o de 10 destacado em accent |
| Bitcoin | "acima de 12,0%" |
| Ações BR | "abaixo de 11,0%" |
| Sliders | mover o prazo muda o total **na hora**, sem piscar |

👁 Donut de 164px com furo mostrando o total. Card do simulador escuro, valor em
Caprasimo 32px. Barra do marco escolhido em accent, as outras em accent-300.

## 07 · Metas e orçamentos

| Conferir | Esperado |
| --- | --- |
| Resumo | "4 metas ativas · R$ 70.350 de R$ 189.000 acumulados" |
| Reserva de emergência | 61% · "Guardar R$ 967 por mês para chegar em 12 meses" |
| Viagem ao Japão | 30% · "Guardar R$ 931 por mês" |
| Painel de orçamento | "2 categorias acima do limite" |
| Ordem | Moradia (183%) primeiro, Lazer (36%) por último |

👁 Barra da meta com 10px. Linha do orçamento: nome à esquerda, barra flexível,
texto à direita.

## 08 · Relatórios

| Conferir | Esperado |
| --- | --- |
| Taxa de poupança | 46% |
| Custo fixo | R$ 6.118 |
| Custo variável | R$ 1.666 |
| Meses de reserva | 2 (card em `--color-accent-2-200`) |
| Insights | "Moradia foi a maior saída do mês, com R$ 4.769,90" |

👁 Gráfico de fluxo com 190px de altura (mais alto que o do dashboard).

## 09 · Contas

| Conferir | Esperado |
| --- | --- |
| Nubank | R$ 6.420,80 · "Conta corrente · Ana" |
| Itaú | R$ 12.310,45 · "Conta conjunta · Ana e Bruno" |
| Reserva | R$ 3.150,00 · "Poupança · Conjunta" |
| Últimas importações | 3 linhas, com etiqueta "N classificados" |
| Tile de importação | borda tracejada; no hover vira accent |

👁 Monograma de 36px em sálvia. Saldo em Caprasimo 24px.

## 10 · Primeiros passos

| Conferir | Esperado |
| --- | --- |
| Pílulas | 4 passos; atual em accent, concluídos em sálvia, futuros em neutro |
| Passo 4 | CTA vira "Ir para o painel" e navega para a visão geral |
| Trocar de passo | animação `riseIn` de entrada |
| Números | vêm do banco (contas, categorias, assinaturas, ativos reais) |

## 11 · Diálogo de novo lançamento

| Conferir | Esperado |
| --- | --- |
| Abrir | botão "Novo lançamento" em qualquer tela |
| Campos | Descrição (largura total) · Valor · Data · Tipo · Categoria · Conta ou cartão · Responsável · Parcelas |
| Categoria | muda de lista ao trocar Tipo entre Saída e Entrada |
| Valor | aceita `1.234,56` |
| Salvar vazio | erro por campo, em vermelho, e nada é enviado |
| Esc | fecha |
| Tab | circula dentro do diálogo, não escapa para trás |
| Fechar | o foco volta para o botão que abriu |

👁 Diálogo com 540px, campos em duas colunas, rodapé com Cancelar + Salvar
alinhados à direita.

---

## Responsivo

Estreite a janela até ~360px:

- [ ] A sidebar vira um botão de menu; o conteúdo ocupa a largura toda
- [ ] Abrir o menu mostra o drawer com backdrop; Esc e clique fora fecham
- [ ] **Nenhuma tela rola na horizontal** — as tabelas rolam dentro da própria caixa
- [ ] Os cards empilham em uma coluna

## Teclado

- [ ] Primeiro Tab revela "Pular para o conteúdo"
- [ ] Todo elemento focado tem anel de 2px em accent
- [ ] Setas navegam o filtro Todos/Entradas/Saídas
- [ ] Excluir sempre pede confirmação, com o foco em "Cancelar"

## Limites conhecidos

- Rótulo do botão primário: **3,03:1** (AA pede 4,5:1)
- Cabeçalho de tabela: **3,99:1**

Ambos vêm do design system, que o handoff manda copiar sem alterar. Medidos e
documentados em `apps/web/src/contraste.test.ts`, com as correções possíveis.
