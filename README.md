# Raiz — sistema de gerenciamento financeiro

Gestão financeira pessoal e familiar em pt-BR: lançamentos, categorias, assinaturas, cartões com
fatura, investimentos com projeção de juros compostos, metas, orçamentos, relatórios, contas com
importação de extrato e onboarding.

Construído a partir do handoff em `Sistema de gerenciamento financeiro/design_handoff_raiz_financas/`,
que permanece no repositório como **fonte da verdade** de layout, cópia e regras de cálculo.

## Stack

| Camada | Escolha |
| --- | --- |
| Monorepo | pnpm workspaces + Turborepo |
| Frontend | React 19 + TypeScript + Vite + React Router + TanStack Query |
| Estilo | design system **Organic**, copiado sem alteração (`packages/ui/src/organic/styles.css`) |
| Backend | Fastify 5 + TypeScript + Zod, como Vercel Function |
| Banco | PostgreSQL + Prisma 6 (Neon em produção) |
| Auth | e-mail/senha, JWT + refresh httpOnly rotativo, escopo por household |
| Testes | Vitest |

## Estrutura

```
raiz/
├─ apps/web            SPA React            → projeto Vercel "raiz-web"
├─ apps/api            Fastify              → projeto Vercel "raiz-api"
├─ packages/core       regras financeiras   (TS puro, sem deps, 100% testado)
├─ packages/ui         design system Organic em React
├─ packages/schemas    validacao Zod compartilhada API + formularios
└─ Sistema de gerenciamento financeiro/     o handoff original — referência, não código
```

`packages/core` existe porque as fórmulas precisam rodar **nos dois lados**: o backend é a fonte da
verdade, mas os sliders do simulador de investimentos recalculam localmente para responder sem
round-trip. Uma implementação só, testada uma vez.

## Rodando

```bash
pnpm install
pnpm dev          # web em :5173, api em :3333
```

O Vite faz proxy de `/api` para o Fastify, espelhando o rewrite da Vercel — assim `/api` é
same-origin em dev e em produção, e o cookie de refresh não precisa de `SameSite=None`.

### Banco

Precisa de um Postgres. Com um servidor local rodando, crie o papel e o banco uma vez:

```bash
psql -U postgres -c "CREATE ROLE raiz LOGIN PASSWORD 'raiz' CREATEDB;" \
                 -c "CREATE DATABASE raiz OWNER raiz;"
```

Depois, dentro de `apps/api`:

```bash
pnpm db:migrate   # aplica as migrations
pnpm db:seed      # popula com os dados do protótipo (idempotente)
pnpm db:studio    # inspeciona os dados
pnpm db:reset     # zera e refaz tudo
```

O seed cria o household "Casa da Ana e do Bruno" com login `ana@raiz.app` / `raiz1234`.
Rodar de novo apaga e recria — nunca duplica.

```bash
pnpm test         # suite completa
pnpm typecheck    # tsc --noEmit em todos os pacotes
pnpm build        # build de produção
```

Variáveis de ambiente: copie `apps/api/.env.example` → `apps/api/.env` (e o mesmo em `apps/web`).

## Deploy

Dois projetos Vercel apontando para o mesmo repositório, com Root Directory diferente:

| Projeto | Root Directory | Observação |
| --- | --- | --- |
| `raiz-web` | `apps/web` | framework Vite; rewrite de `/api/*` para o domínio da API |
| `raiz-api` | `apps/api` | `api/index.ts` sobe o Fastify uma vez por container e delega cada requisição via `server.emit('request')` |

Depois de criar `raiz-api`, ajuste o destino do rewrite em `apps/web/vercel.json` para o domínio real.

## Modelo de dados

13 modelos em `apps/api/prisma/schema.prisma`. Três decisões que valem ser lidas antes de mexer:

1. **Dinheiro é `Decimal(12,2)`, nunca `Float`.** Somar centavos em ponto flutuante acumula erro.
2. **`Transaction` aponta para uma conta OU um cartão.** O protótipo guardava um campo de texto que
   às vezes era banco, às vezes cartão; como a fatura *é* essa distinção, ela virou estrutural.
3. **`Invoice` existe só para o estado de pagamento.** O total continua derivado da soma das
   transações do cartão na competência — `Invoice.total` é cache, e um teste garante que não diverge.

O seed vive em dois arquivos de propósito: `prisma/seed-data.ts` é dado puro (testável sem banco) e
`prisma/seed.ts` só escreve. `seed-data.test.ts` recalcula os agregados e compara com os números dos
screenshots; `seed.integration.test.ts` confere a ida e volta pelo Postgres e pula sozinho quando não
há banco alcançável.

## Importação de extrato

 lê CSV e OFX reconhecendo as variações comuns dos bancos
brasileiros: separador  ou , cabeçalhos com nomes diferentes, três formatos de data,
valor em pt-BR ou en-US, e débito/crédito em colunas separadas. Linha ilegível é pulada com o
motivo, não derruba o arquivo inteiro.

O fluxo é **analisar e depois gravar**:  diz o que entraria (com
duplicatas marcadas e categorias sugeridas pelas regras) sem escrever nada;  grava o
que a pessoa aprovou. Importar às cegas um extrato de 200 linhas é difícil de desfazer.

O cron diário (, protegido por ) gera os lançamentos
recorrentes, levanta alertas de teste grátis e fatura fechando, e limpa refresh tokens vencidos.
É idempotente: rodar duas vezes no mesmo dia não duplica nada.

## Vitrine do design system

`/design-system` renderiza todos os componentes em todos os estados — incluindo os raros (vazio,
erro, estouro de orçamento, modo privacidade). É a forma rápida de conferir o sistema contra os
screenshots do handoff. Fica fora da navegação: é ferramenta de desenvolvimento, não tela do produto.

O modo privacidade é aplicado na **formatação**, não no dado: componentes de tela usam `<Money>` /
`useMoney()`, nunca `formatBRL` direto. Assim nenhuma tela pode esquecer de mascarar.

## Regras que não podem errar

Estão em `packages/core/src/finance.ts` e cobertas por `parity.test.ts`, que replica a classe
`Component` do protótipo **literalmente** e compara os dois — 240 combinações dos três sliders do
simulador, além de mensalização, donut, marcos e formatação.

```
mensalizar(assinatura)  = valor / {MENSAL:1, TRIMESTRAL:3, SEMESTRAL:6, ANUAL:12}
taxaMensal(anual)       = (1 + anual)^(1/12) - 1
valorFuturo(pv,i,pmt,n) = pv*(1+r)^n + pmt*(((1+r)^n - 1)/r)
projecaoCarteira(meses) = Σ fv(valor, (taxa+ajuste)/100, aporte + extra*(valor/total), meses)
```

Se um desses números mudar, o build quebra. É de propósito.

## Design system

`packages/ui/src/organic/styles.css` é cópia byte a byte do handoff e **não deve ser editado** —
veja `packages/ui/src/organic/NAO-EDITAR.md`. Todo estilo consome as variáveis dele; layout por
componente vai em CSS Modules em cima de `var(--space-*)`.

## Progresso

- [x] **Etapa 0** — Bootstrap: monorepo, tooling, Organic, shell, health check ponta a ponta
- [x] **Etapa 1** — `packages/core`: fórmulas + formatação pt-BR + dedupe, com paridade testada
- [x] **Etapa 2** — `packages/ui`: componentes do design system + shell responsivo definitivo
- [x] **Etapa 3** — Backend: schema Prisma, migrations, seed com os dados do protótipo
- [x] **Etapa 4** — Backend: auth + CRUD + endpoints agregados
- [x] **Etapa 5** — As 10 telas, em 4 ondas
- [x] **Etapa 6** — Diálogos, validação e estados (vazio, carregando, erro, confirmação)
- [x] **Etapa 7** — Importação CSV/OFX, regras automáticas, recorrências, cron diário
- [ ] **Etapa 8** — Responsivo em aparelho real, acessibilidade, performance
- [ ] **Etapa 9** — Produção: env, migrations no deploy, domínio, QA contra os screenshots
