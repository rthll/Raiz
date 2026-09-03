# Deploy na Vercel

Dois projetos Vercel apontando para o mesmo repositório, com **Root Directory**
diferente. O frontend faz rewrite de `/api/*` para a API, o que mantém tudo na
mesma origem — é isso que permite o cookie de refresh ser `SameSite=Lax` em vez
de `None`.

```
navegador → raiz-web (SPA)         /            → arquivos estáticos
                                   /api/*       → rewrite → raiz-api
raiz-api  → Fastify em Function    /api/*       → Neon Postgres
```

## 1. Banco

Provisione um **Neon Postgres** (Vercel → Storage → Neon, ou neon.tech direto).

Use a connection string **pooled** — a que tem `-pooler` no host. Cada container
frio abre a própria conexão, e sem o pooler o Postgres esgota o limite.

```
postgresql://user:senha@ep-xxx-pooler.region.aws.neon.tech/raiz?sslmode=require
```

## 2. Projeto `raiz-api`

| Configuração | Valor |
| --- | --- |
| Root Directory | `apps/api` |
| Include files outside root | **ligado** (o monorepo precisa dos `packages/*`) |
| Framework Preset | Other |

As migrations rodam no build (`prisma migrate deploy` no `vercel.json`), então
todo deploy chega ao banco já com o schema em dia. Se a migration falhar, o
deploy falha — que é o comportamento certo: melhor não subir do que subir com o
schema errado.

`apps/api/public/index.html` existe por exigência da plataforma, não do produto.
Definir um `buildCommand` próprio com `framework: null` faz a Vercel cobrar um
diretório estático ao final do build, e ela recusa tanto a ausência dele quanto
um diretório vazio. Como o rewrite `/(.*)` → `/api` roda antes da checagem de
filesystem, nenhuma requisição chega nesse arquivo.

### Variáveis de ambiente

| Variável | Obrigatória | Observação |
| --- | --- | --- |
| `DATABASE_URL` | sim | connection string pooled do Neon |
| `JWT_SECRET` | sim | ≥ 32 caracteres |
| `JWT_REFRESH_SECRET` | sim | ≥ 32 caracteres, **diferente** do anterior |
| `CRON_SECRET` | sim | ≥ 16 caracteres; sem ele o cron recusa tudo |
| `CORS_ORIGINS` | sim | domínio do frontend, separado por vírgula |
| `ACCESS_TOKEN_TTL` | não | padrão `15m` |
| `REFRESH_TOKEN_TTL_DIAS` | não | padrão `30` |

`NODE_ENV=production` a Vercel já define. É o que liga o `secure` no cookie e o
HSTS nos cabeçalhos — não sobrescreva.

Gere os segredos com:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

O boot recusa subir se algum segredo faltar, for curto demais, ou se os dois JWT
forem iguais. É de propósito: um segredo de acesso que também assina refresh
transforma um token vazado em sessão eterna.

## 3. Projeto `raiz-web`

Vercel → **Add New** → **Project** → importe o **mesmo repositório** do
`raiz-api`. Dois projetos apontando para um repositório só é o esperado; o que
os separa é o Root Directory.

| Configuração | Valor |
| --- | --- |
| Project Name | `raiz-web` |
| Root Directory | `apps/web` |
| Include files outside root | **ligado** — sem isso o `pnpm install` não acha `packages/*` |
| Framework Preset | Vite |

**Não preencha Build, Install nem Output Directory no painel.** Os três já vêm
do `apps/web/vercel.json`, e o que estiver no painel vira só um segundo lugar
onde a verdade pode divergir.

O `buildCommand` de lá compila `@raiz/core` e `@raiz/schemas` antes do
`vite build`. Não é zelo: os dois pacotes resolvem para `dist` fora da condição
de export `development`, então sem esse passo o build morre em
`Failed to resolve entry for package "@raiz/core"`.

### Variáveis de ambiente

Nenhuma é obrigatória — `VITE_API_URL` só existe para deixar explícito o `/api`
que o código já usa por padrão (`apps/web/src/api/client.ts`).

Se declarar, **dê um valor**. Uma chave criada em branco não é o mesmo que uma
chave ausente para quem lê `process.env`, e foi assim que o primeiro boot da API
caiu. O `loadEnv` da API passou a descartar as vazias, mas a regra continua
valendo para qualquer painel.

O destino do rewrite em `apps/web/vercel.json` já aponta para
`https://raiz-api.vercel.app`, que é o domínio de produção da API e responde sem
autenticação. As URLs de deployment (`raiz-api-*-projects.vercel.app`) devolvem
302 para o SSO da Vercel — não sirvam de destino de rewrite.

## 4. Primeiro acesso

O banco sobe vazio — o seed é dado de demonstração e **não deve ir para
produção**. Crie a primeira conta pela própria tela de registro, que já monta o
household junto.

Para popular um ambiente de preview com os dados do protótipo:

```bash
DATABASE_URL="<url do preview>" pnpm --filter @raiz/api db:seed
```

## 5. Cron

O `vercel.json` da API já declara `0 6 * * *` (6h UTC, 3h em Brasília). A Vercel
chama com `Authorization: Bearer $CRON_SECRET`.

Para disparar à mão:

```bash
curl -X POST https://SEU-DOMINIO-DA-API/api/cron/daily \
  -H "Authorization: Bearer $CRON_SECRET"
```

## 6. Conferindo

```bash
curl https://SEU-DOMINIO-DA-API/api/health
```

Devolve `200` com `"banco": "ok"`, ou **`503` com `"banco": "indisponivel"`** —
o health check toca o Postgres de propósito. Uma API que responde 200 sem
conseguir consultar o banco deixa o monitoramento verde enquanto todas as telas
quebram.

## Pendências conhecidas

- **Contraste do botão primário e do cabeçalho de tabela** ficam abaixo de
  WCAG AA (3,03:1 e 3,99:1). Vêm do design system, que o handoff manda copiar
  sem alterar. Estão medidos e documentados em `apps/web/src/contraste.test.ts`,
  com as duas correções possíveis. Precisa de decisão de design.
- **Não há canal de notificação.** O cron levanta os alertas de teste grátis e
  fatura fechando e os devolve na resposta; ninguém os envia. O dashboard mostra
  os mesmos avisos na tela.
