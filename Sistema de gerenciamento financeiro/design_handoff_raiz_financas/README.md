# Handoff: Raiz — Sistema de Gerenciamento Financeiro Pessoal

## Visão geral

Raiz é um sistema web (responsivo) de gestão financeira pessoal/familiar. Ele registra **entradas e saídas**,
classifica por **categorias personalizáveis** e adiciona três módulos maiores: **assinaturas**, **cartões com
faturas** e **investimentos com projeções de juros compostos**. Complementos: metas/orçamentos, relatórios,
contas bancárias com importação de extrato (CSV/OFX), regras de classificação automática, recorrências e
onboarding em 4 passos.

Público: uso pessoal e de casal/família (todo lançamento tem um responsável: Ana, Bruno ou Conjunta).
Moeda: BRL. Idioma da interface: pt-BR.

## Sobre os arquivos de design

Os arquivos em `design/` são **referências de design feitas em HTML** — um protótipo que demonstra aparência,
hierarquia e comportamento pretendidos. **Não são código de produção para copiar.** A tarefa é **recriar esses
designs no ambiente do codebase de destino** usando seus padrões e bibliotecas estabelecidos. Como ainda não
existe codebase, a recomendação está em "Stack sugerida" — escolha e implemente ali.

`design/Raiz Gestao Financeira.dc.html` é um componente de design em um runtime próprio (`support.js`): um
template HTML com placeholders `{{ }}` e uma classe de lógica JS que calcula todos os valores derivados.
Leia esse arquivo como **fonte da verdade de layout, cópia e regras de cálculo** — a classe `Component`
contém as fórmulas reais (mensalização de assinaturas, fatura por cartão, valor futuro, orçamentos).

Abrir localmente: sirva a pasta `design/` por HTTP (`python3 -m http.server`) e abra o `.dc.html`.

## Fidelidade

**Alta fidelidade (hi-fi).** Cores, tipografia, espaçamentos, raios e estados finais. Recrie a UI fielmente.
Todo o estilo vem do design system **Organic** (`design/ds/styles.css` + `design/ds/organic-readme.md`):
copie esse CSS para o novo projeto e consuma as variáveis e classes dele — não redefina valores.

## Stack sugerida (se for começar de zero)

- **Frontend**: React + TypeScript + Vite, React Router, TanStack Query para dados do servidor.
  Estilo: importar `styles.css` do Organic e usar as classes (`.card`, `.btn`, `.table`, `.tag`, `.input`,
  `.seg`, `.dialog`) + CSS Modules/`style` inline para layout. Gráficos: barras e donut feitos com
  `div` + `conic-gradient` (como no protótipo) ou Recharts com as cores dos tokens.
- **Backend**: Node + TypeScript (NestJS ou Fastify) + Prisma + PostgreSQL. Alternativa igualmente válida:
  Python + FastAPI + SQLAlchemy.
- **Autenticação**: e-mail/senha + JWT (refresh token httpOnly). Contas compartilhadas por *household*.
- **Testes**: Vitest/Jest no domínio financeiro (mensalização, fatura, valor futuro) — são as regras que
  não podem errar.

## Estrutura da tela

Layout de duas colunas, `display:flex; flex-wrap:wrap` (sem media queries: colapsa naturalmente).

- **Sidebar** — `flex: 0 0 252px`, `min-width: 220px`, `padding: var(--space-6) var(--space-4)`, fundo
  `--color-bg`. Contém: marca (círculo `34px` em `--color-accent` + "Raiz" em `--font-heading` 19px e
  "finanças da casa" 11px `--color-neutral-600`); nav vertical de 10 itens; card "Saldo previsto" no rodapé
  (`margin-top:auto`, fundo `--color-accent-2-200`).
- **Item de nav** — botão, texto à esquerda, `font-size:14px`, `padding:9px 14px`, `border-radius:999px`.
  Inativo: fundo transparente, cor `--color-text`; hover: `color-mix(in srgb, var(--color-text) 6%, transparent)`;
  **ativo**: fundo `--color-accent-200`, cor `--color-accent-900`, `font-weight:600`.
- **Main** — `flex: 1 1 640px`, `padding: var(--space-6)`, fundo `--color-neutral-100`,
  `border-radius: var(--radius-lg) 0 0 var(--radius-lg)`.
- **Header do main** — flex com `space-between`, `flex-wrap`. Esquerda: kicker (`.card-kicker`, 10px,
  uppercase, `--color-accent`) + `h2` (Caprasimo 32px). Direita: seletor de mês (pílula
  `--color-surface`, botões `‹ ›` `.btn.btn-icon.btn-ghost`, label 13px com `min-width:104px`),
  botão `.btn.btn-secondary` "Importar CSV/OFX" e `.btn.btn-primary` "Novo lançamento".
- **Banner de alerta** (condicional) — fundo `--color-accent-200`, `border-radius: var(--radius-lg)`,
  `padding: var(--space-3) var(--space-4)`; tag "Atenção" (fundo `--color-accent`, texto `--color-bg`),
  texto 13px `--color-accent-900`, botão "Revisar" alinhado à direita (`margin-left:auto`).
- **Grids de conteúdo** — sempre `grid-template-columns: repeat(auto-fit, minmax(Xpx, 1fr))` com
  `gap: var(--space-3)`; X = 190 (KPIs), 268–320 (cards médios), 300 (painéis largos).

## Telas

### 1. Visão geral (`dashboard`)
Propósito: estado do mês em uma tela.
- **4 KPIs** (`minmax(190px,1fr)`): "Saldo em contas", "Entradas do mês" (valor em `--color-accent-2-700`),
  "Saídas do mês" (`--color-accent-700`), "Patrimônio total" (card escuro: fundo `--color-accent-900`,
  texto `--color-neutral-100`). Valor em Caprasimo 27px; rótulo 12px `--color-neutral-700`; nota 12px.
- **Fluxo de caixa** — card com 8 colunas (Mar→Out). Cada coluna: duas barras de `18px` de largura,
  altura proporcional ao maior valor da série, `border-radius: 999px 999px 4px 4px`; entradas
  `--color-accent-2-500`, saídas `--color-accent-500`. Meses futuros (índice > 5) com `opacity: .45` e
  rótulo em itálico `--color-neutral-600`. Altura da área: 176px. Legenda com dois círculos de 10px.
- **Para onde o dinheiro foi** — top 6 categorias: linha com dot 10px da cor da categoria, nome, valor à
  direita, e barra de progresso (trilha `--color-neutral-200`, 8px, raio 999px) proporcional à maior categoria.
- **Próximos vencimentos** — 3 assinaturas ativas + 2 faturas. Cada linha: pílula circular 40px com o dia
  (Caprasimo 15px; destaque = fundo `--color-accent-200`/texto `--color-accent-900`, normal =
  `--color-neutral-200`/`--color-neutral-800`), nome 14px, detalhe 11px, valor 14px/600.
  Separador: `border-bottom: 1px solid var(--color-divider)`.
- **Divisão do casal** (só com `modoCasal`) — barras por responsável (Ana `--color-accent`,
  Bruno `--color-accent-2-500`, Conjunta `--color-neutral-500`) + caixa de acerto
  (fundo `--color-accent-2-100`, `--radius-md`): "Bruno transfere R$ X para a Ana."
- **Investido** — total, taxa média ponderada, projeção no prazo atual e botão para investimentos.

### 2. Lançamentos (`lancamentos`)
- **Filtros**: `.seg` com 3 rádios (Todos / Entradas / Saídas), `select.input` de categoria,
  `input.input` de busca por descrição (`flex:1; min-width:180px`), e resumo textual à direita
  ("N de M lançamentos · saldo do mês R$ X").
- **Tabela** `.table` dentro de `.card`: Data | Descrição | Categoria | Conta/cartão | Responsável |
  Valor (direita) | ações. Descrição pode exibir `.tag.tag-neutral` "recorrente". Categoria com dot colorido.
  Valor: entradas `+ R$` em `--color-accent-2-700`, saídas `– R$` em `--color-text`, `font-weight:600`.
  Ações: `.btn.btn-ghost` "Editar" e "Excluir" (cinza `--color-neutral-700`).
- **Faixa de recorrências** — card `--color-accent-2-200` com contagem de lançamentos recorrentes e
  atalhos para importar extrato / novo lançamento.

### 3. Categorias (`categorias`)
- Resumo textual + botão "Nova categoria".
- **Card por categoria** (`minmax(268px,1fr)`): dot 26px da cor, nome (`.card-title` 17px), meta
  "Saída · N lançamentos" (11px), chip de % à direita (verde `--color-accent-2-100/800`;
  **estouro > 100%** vira `--color-accent-200/800` e a barra passa a `#8c491a`), barra 9px,
  linha "R$ X usados / limite R$ Y", botões Editar (`.btn-secondary`) e Excluir (`.btn-ghost`).
- **Regras de classificação automática** — lista `termo do extrato → categoria`, com o termo em
  `code` sobre `--color-neutral-200` e raio 999px, e contagem de acertos à direita.

### 4. Assinaturas (`assinaturas`)
- **4 KPIs**: custo mensal, custo anual (mensal × 12), "Ativas / pausadas", "% da renda"
  (card `--color-accent-200`).
- **Card por assinatura**: monograma circular 38px (inicial do nome; ativa = `--color-accent-200`,
  pausada = `--color-neutral-200`), nome, "categoria · cartão", chip de status
  (Ativa = sage, Teste grátis = accent, Pausada = neutro), valor Caprasimo 22px + "/ mensal",
  linha "Equivale a R$ X por mês · próximo débito DD/MM", caixa de observação (fundo `--color-accent-200`,
  texto `--color-accent-900`) e ações **Editar / Pausar-Reativar / Excluir**.
- Regra de mensalização: `valor / {Mensal:1, Trimestral:3, Semestral:6, Anual:12}[periodo]`.
  Pausadas **não** entram nos totais.

### 5. Cartões e faturas (`cartoes`)
- **Cartão selecionável** (botão): `min-height:178px`, raio `calc(var(--radius-lg)*1.15)`,
  padding `--space-4`. Primeiro cartão é escuro (`--color-accent-900` / `--color-neutral-100`), os demais
  usam `--color-surface`. Selecionado: `border: 2px solid var(--color-accent)` + `--shadow-md`
  (não selecionado: borda transparente de 2px, sem sombra). Conteúdo: apelido (Caprasimo 18px),
  "bandeira · •••• final", círculo decorativo 26px `currentColor` a 25%, e no rodapé: "fatura aberta" +
  valor, barra de uso do limite (7px) e "limite R$ X · fecha DD/MM · vence DD/MM".
- **Fatura do cartão selecionado** — kicker "Fatura de <mês>", título "Nome · •••• 4821", subtítulo com
  fechamento/vencimento/limite; à direita total em Caprasimo 23px + "Editar cartão" + "Marcar como paga"
  (alterna para "Fatura paga"). Tabela: Data | Lançamento | Categoria | Parcela | Valor.
  Rodapé: "N assinaturas debitam neste cartão (R$ X/mês) · N compra parcelada em andamento".
- A fatura é a soma dos lançamentos cujo `conta` é o nome do cartão.

### 6. Investimentos (`investimentos`)
- **Donut de alocação** — `164px`, `border-radius:999px`,
  `background: conic-gradient(cor início% fim%, …)` por classe de ativo, com furo interno
  (`position:absolute; inset:26px`) em `--color-surface` mostrando "Investido" + total.
  Cores por classe: Renda fixa `#d67f48`, Fundos imobiliários `#8fa073`, Ações exterior `#b2622d`,
  Ações Brasil `#aebf92`, Cripto `#645c50`. Legenda ao lado com dots de 12px e %.
- **Simulador de cenários** — card escuro `--color-accent-900`. Valor projetado em Caprasimo 32px;
  linha "em N anos · aporte mensal de R$ X · taxa média Y% a.a."; três `input[type=range]`
  (`accent-color: var(--color-accent)`): prazo 1–30 anos (passo 1), ajuste de taxa −3 a +4 p.p.
  (passo 0,5), aporte extra 0–3000 (passo 100). Nota final: quanto do total é juros vs. aporte.
- **Provisão futura por marco** — barras para 1, 3, 5, 10 e 20 anos; `max-width:76px`, altura
  proporcional ao maior marco (até 118px), raio `var(--radius-md) var(--radius-md) 6px 6px`;
  a barra do prazo escolhido no simulador fica em `--color-accent`, as outras em `--color-accent-300`.
  Valor formatado acima, rótulo abaixo.
- **Tabela de ativos**: Ativo | Classe (com dot) | Valor atual | Taxa a.a. | Aporte mensal |
  Meta (chip "acima/abaixo de X%") | Em N anos | ações.

**Fórmulas (implementar no backend e cobrir com testes):**
```
taxaMensal(anualDecimal)      = (1 + anual) ^ (1/12) - 1
valorFuturo(pv, anual, pmt, n)= pv * (1+r)^n + pmt * (((1+r)^n - 1) / r),  r = taxaMensal(anual)
projecaoCarteira(meses)       = Σ ativos: valorFuturo(valor, (taxa + ajuste)/100,
                                aporte + aporteExtra * (valor / totalInvestido), meses)
taxaMediaPonderada            = Σ (taxa_i * valor_i) / Σ valor_i
totalAportado                 = totalInvestido + (Σ aportes + aporteExtra) * meses
jurosProjetados               = projecao - totalAportado
```

### 7. Metas e orçamentos (`metas`)
- Card por meta: nome, chip de %, barra 10px (`--color-accent`; ≥100% vira `#8fa073`),
  "R$ atual de R$ alvo" e sugestão "Guardar R$ X por mês para chegar em N meses"
  (`(alvo - atual) / prazoMeses`).
- Painel "Orçamento do mês por categoria": linha com dot + nome (`min-width:150px`), barra flexível
  e texto "R$ gasto de R$ limite · %" (`min-width:150px`, alinhado à direita).

### 8. Relatórios (`relatorios`)
- 4 KPIs: taxa de poupança `(entradas - saídas)/entradas`, custo fixo (Moradia, Assinaturas, Saúde,
  Educação), custo variável (Alimentação, Lazer, Transporte) e meses de reserva
  `reserva / saídas do mês` (card `--color-accent-2-200`).
- Gráfico de entradas e saídas por mês (mesmo componente do dashboard, altura 190px).
- "Maiores categorias do mês" (barras horizontais) e "O que mudou" (insights com dot colorido).

### 9. Contas (`contas`)
- Card por conta: monograma 36px (`--color-accent-2-200` / `--color-accent-2-900`), nome,
  "tipo · dono", saldo em Caprasimo 24px, "último extrato importado …".
- **Tile de importação**: `border: 1px dashed var(--color-neutral-400)`, mesmo raio dos cards,
  hover muda a borda para `--color-accent`.
- Tabela "Últimas importações": Arquivo | Conta | Período | Lançamentos | Classificados
  (`.tag.tag-accent-2`).

### 10. Primeiros passos (`onboarding`)
4 passos em pílulas (atual = `--color-accent`/`--color-bg`; concluído = `--color-accent-2-200`;
futuro = `--color-neutral-200`). Card com kicker "Passo N de 4", título `h3`, descrição, 3 tiles
(`--color-neutral-100`, `--radius-md`) e ações Voltar / Continuar / "Pular para o painel".
No passo 4 o CTA vira "Ir para o painel" e navega para o dashboard. Animação de entrada:
`riseIn .25s ease` (`opacity 0→1`, `translateY(8px)→0`).

## Diálogos (CRUD)

Modal único: `.dialog-backdrop` (fundo `color-mix(in srgb, var(--color-neutral-900) 50%, transparent)`)
com `.dialog` de `width: min(540px, 100%)`, animação `riseIn .2s ease`. Campos em grid de 2 colunas
(`gap: var(--space-3)`), cada um `.field > label` + `.input`. Rodapé `.dialog-actions`:
"Cancelar" (`.btn-secondary`) + CTA primário ("Salvar" / "Salvar alterações" / "Importar 42 lançamentos").

| Diálogo | Campos |
| --- | --- |
| Lançamento | Descrição (full) · Valor · Data · Tipo (Saída/Entrada) · Categoria · Conta ou cartão · Responsável (Ana/Bruno/Conjunta) · Recorrência (Nenhuma/Mensal/Semanal/Anual) |
| Assinatura | Serviço (full) · Valor cobrado · Período (Mensal/Trimestral/Semestral/Anual) · Próximo débito · Cartão · Categoria · Status (Ativa/Pausada/Teste grátis) · Observação (full) |
| Cartão | Apelido · Bandeira (Visa/Mastercard/Elo/Amex) · Final · Limite · Dia de fechamento · Dia de vencimento |
| Ativo | Ativo (full) · Classe · Valor atual · Taxa de retorno (% a.a.) · Aporte mensal · Meta de rentabilidade (% a.a.) |
| Categoria | Nome · Tipo · Limite mensal · Cor (Terracota #d67f48, Sálvia #8fa073, Âmbar #b2622d, Terra #645c50, Musgo #aebf92) |
| Meta | Meta (full) · Valor alvo · Já guardado · Prazo em meses |
| Importar | Área de arrastar arquivo (CSV/OFX até 5 MB, borda tracejada) · Conta de destino · checkbox "Aplicar regras automáticas" · checkbox "Ignorar duplicados" |

Validação a implementar (o protótipo não valida): obrigatórios nome/descrição, valor > 0, data válida,
taxa entre −100 e 100, limite ≥ 0, prazo inteiro ≥ 1. Parsing pt-BR: aceitar `1.234,56` →
remover pontos, trocar vírgula por ponto.

## Interações e comportamento

- Navegação client-side entre as 10 telas (rotas: `/`, `/lancamentos`, `/categorias`, `/assinaturas`,
  `/cartoes`, `/investimentos`, `/metas`, `/relatorios`, `/contas`, `/onboarding`).
- Seletor de mês `‹ ›` limitado ao intervalo carregado; deve refiltrar todos os dados por competência.
- Filtros de lançamento aplicados em conjunto (tipo AND categoria AND busca case-insensitive).
- Selecionar um cartão troca a fatura exibida abaixo, sem recarregar a página.
- Sliders do simulador recalculam projeção, marcos e a coluna "Em N anos" da tabela em tempo real
  (debounce não é necessário se o cálculo for local; se for no servidor, 250ms).
- Pausar assinatura remove seu custo dos totais imediatamente.
- "Marcar como paga" alterna o estado da fatura.
- Estados a criar (ausentes no protótipo): vazio (nenhum lançamento no mês), carregando (skeleton nos
  cards), erro de importação (arquivo inválido / duplicados detectados), confirmação antes de excluir.
- Foco de teclado: `:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px }` —
  já vem no CSS do Organic; não sobrescrever.
- Responsivo: a sidebar colapsa para o topo (é um item flex com `flex-wrap`); os grids `auto-fit`
  reduzem colunas sozinhos. Em mobile real, transformar a sidebar em barra inferior ou drawer.

## Estado / dados do cliente

Estado de UI: `tela`, `mes`, `dialog` (tipo|null), `form`, `editId`, `filtroTipo`, `filtroCat`, `busca`,
`cartaoSel`, `anos`, `ajuste`, `aporteExtra`, `passo`, `faturaPaga`.
Estado de domínio (vem da API): `contas`, `categorias`, `transacoes`, `assinaturas`, `cartoes`, `ativos`,
`metas`, `regras`, `importacoes`.
Flags de preferência (no protótipo são props tweakáveis, no produto vão em preferências do usuário):
`modoPrivacidade` (mascara todos os valores como `R$ ••••`), `modoCasal` (mostra coluna Responsável e o
painel de divisão), `alertasVencimento` (exibe o banner do topo).

## Modelo de dados sugerido (Prisma-like)

```
User        id, email, senhaHash, nome, householdId, preferencias(json)
Household   id, nome
Account     id, householdId, nome, tipo(corrente|conjunta|poupanca), dono, saldo, ultimaSync
Card        id, householdId, nome, bandeira, final, limite, diaFechamento, diaVencimento, temaEscuro
Category    id, householdId, nome, tipo(entrada|saida), cor, orcamentoMensal
Transaction id, householdId, data, descricao, valor(decimal), tipo, categoriaId,
            accountId?, cardId?, responsavel, parcelaAtual?, parcelaTotal?,
            recorrenciaId?, importacaoId?, fingerprint(unique p/ dedupe)
Recurrence  id, householdId, descricao, valor, periodo, proximaData, categoriaId, origemId, ativa
Subscription id, householdId, nome, valor, periodo(MENSAL|TRIMESTRAL|SEMESTRAL|ANUAL),
            proximoDebito, cardId, categoriaId, status(ATIVA|PAUSADA|TESTE), observacao, precoAnterior?
Invoice     id, cardId, competencia(YYYY-MM), fechamento, vencimento, total, paga
Asset       id, householdId, nome, classe, valor, taxaAnual, aporteMensal, metaTaxa
Goal        id, householdId, nome, alvo, atual, prazoMeses
Rule        id, householdId, termo, categoriaId, acertos
Import      id, householdId, accountId, arquivo, periodoInicio, periodoFim, qtd, qtdAuto, criadoEm
```

`Invoice` pode ser derivada (soma das transações do cartão na competência) — materialize apenas quando
precisar de histórico de pagamento.

## API sugerida

```
POST   /auth/login | /auth/refresh | /auth/register
GET    /dashboard?mes=YYYY-MM            → KPIs, fluxo, gasto por categoria, vencimentos, divisão
CRUD   /transactions        (filtros: mes, tipo, categoriaId, q, cardId, accountId)
POST   /transactions/import (multipart CSV/OFX; body: accountId, aplicarRegras, ignorarDuplicados)
CRUD   /categories · /accounts · /cards · /subscriptions · /assets · /goals · /rules
GET    /cards/:id/invoice?mes=YYYY-MM     → itens, total, fechamento, vencimento, assinaturas vinculadas
POST   /cards/:id/invoice/:mes/pay
GET    /subscriptions/summary             → custo mensal, anual, ativas/pausadas, % da renda
POST   /investments/projection            → { anos, ajusteTaxa, aporteExtra } → total, marcos, por ativo
GET    /reports?de=&ate=                  → poupança, fixo vs variável, meses de reserva, insights
GET    /budgets?mes=YYYY-MM
```

Regras de negócio no servidor: mensalização de assinaturas, dedupe de importação por fingerprint
(data + valor + descrição normalizada), aplicação das regras de classificação, geração de lançamentos
recorrentes por job diário, alerta de teste grátis a vencer e de fatura fechando (D-3).

## Design tokens (de `design/ds/styles.css` — não redefinir)

- **Cores**: bg `#f5ead8` · surface `#ebddc5` · text `#201e1d` · accent `#c67139` · accent-2 `#7a8a5e` ·
  divider `color-mix(in srgb,#201e1d 16%,transparent)`.
- **Rampas 100→900**: neutral `#f9f4ed #eee7db #dcd3c4 #c0b6a5 #a19786 #82796a #645c50 #474238 #2e2b25`;
  accent `#fff2eb #ffe1d0 #ffc6a5 #f6a06b #d67f48 #b2622d #8c491a #643312 #402310`;
  accent-2 `#f0fae1 #e1eecc #ccdbb2 #aebf92 #8fa073 #728157 #56633f #3d472b #272e1b`.
- **Tipografia**: heading `Caprasimo` 400; body `Figtree`. Base 15px/1.55.
  h1 42 · h2 32 · h3 25 · h4 20 · h5 16 · h6 13 (uppercase, `letter-spacing:.08em`).
- **Espaçamento**: 4.4 · 8.8 · 13.2 · 17.6 · 26.4 · 35.2px (`--space-1..8`).
- **Raios**: sm 8 · md 16 · lg 28; cards e diálogos `calc(var(--radius-lg)*1.15)`;
  botões, tags, inputs e `.seg` = `999px`.
- **Sombras**: sm `0 1px 2px #2e2b25/14%` · md `0 3px 10px #2e2b25/16%` · lg `0 12px 32px #2e2b25/22%`.
- **Cores de dados** (fora dos tokens, usadas em gráficos/categorias): `#d67f48`, `#8fa073`, `#b2622d`,
  `#aebf92`, `#645c50`, `#f6a06b`, `#728157`, `#56633f`; estouro de orçamento `#8c491a`.
- **Formatação**: `Intl.NumberFormat('pt-BR')`, prefixo `R$ `, 2 decimais (valores grandes de projeção
  usam 0 decimais); percentuais sem decimais com vírgula como separador.

## Assets

Nenhuma imagem ou ícone bitmap. Ícones do protótipo são círculos e caracteres `‹ › →`. O design system
pede **Lucide** com `stroke-width: 2.75` — ao implementar, substitua os dots decorativos onde um ícone
Lucide comunicar melhor (ex.: `credit-card`, `repeat`, `trending-up`, `wallet`, `target`).
Fontes: Google Fonts — `Caprasimo` e `Figtree` (400–700).

## Arquivos deste pacote

- `screenshots/` — captura de cada tela do protótipo, na ordem da navegação:
  `01-visao-geral` · `02-lancamentos` · `03-categorias` · `04-assinaturas` · `05-cartoes-faturas` ·
  `06-investimentos` · `07-metas-orcamentos` · `08-relatorios` · `09-contas` · `10-primeiros-passos` ·
  `11-dialogo-novo-lancamento`. Use como referência visual junto das descrições acima.
- `design/Raiz Gestao Financeira.dc.html` — protótipo completo (template + lógica com todas as fórmulas).
- `design/support.js` — runtime que renderiza o protótipo (referência apenas; não portar).
- `design/ds/styles.css` — **o stylesheet do design system Organic: copie para o novo projeto.**
- `design/ds/organic-readme.md` — guia do design system (direção, componentes, do/don't).
