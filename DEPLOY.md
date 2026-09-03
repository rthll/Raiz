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

| Configuração | Valor |
| --- | --- |
| Root Directory | `apps/web` |
| Include files outside root | **ligado** |
| Framework Preset | Vite |

Depois de o `raiz-api` ter domínio, troque o destino do rewrite em
`apps/web/vercel.json`:

```json
{ "source": "/api/:path*", "destination": "https://SEU-DOMINIO-DA-API/api/:path*" }
```

Variável: `VITE_API_URL=/api` (o padrão do código já é esse; declare para deixar
explícito).

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
