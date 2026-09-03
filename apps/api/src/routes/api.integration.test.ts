/**
 * Testes de integração da API contra o Postgres real.
 *
 * O foco principal é o **isolamento entre households**: cria dois households e
 * confere que nenhum enxerga ou altera nada do outro. Todo o resto da API depende
 * dessa garantia.
 *
 * Pula sozinho quando não há banco alcançável.
 */
import { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { loadEnv } from '../env.js';

const prisma = new PrismaClient();

const bancoDisponivel = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false);

const suite = bancoDisponivel ? describe : describe.skip;
if (!bancoDisponivel) {
  console.warn('\n[api.integration] pulado: sem banco alcançável.\n');
}

const env = loadEnv({
  NODE_ENV: 'test',
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: 'a'.repeat(48),
  JWT_REFRESH_SECRET: 'b'.repeat(48),
  CORS_ORIGINS: 'http://localhost:5173',
} as never);

let app: FastifyInstance;

/** Uma casa de teste completa: usuário, token, categoria, conta e cartão. */
interface Casa {
  email: string;
  accessToken: string;
  householdId: string;
  categoriaId: string;
  accountId: string;
  cardId: string;
}

const emails: string[] = [];

/**
 * Um IP por chamada de credencial.
 *
 * O limite de tentativas é por IP e vale também em teste — de propósito, para
 * exercitar a configuração real de produção. Sem variar o IP, o próprio suite
 * bateria no limite de registro (3 por 10 minutos) e falharia por 429.
 */
let contadorIp = 0;
const proximoIp = () => `198.51.100.${(contadorIp++ % 250) + 1}`;

async function criarCasa(sufixo: string): Promise<Casa> {
  const email = `teste-${sufixo}-${Date.now()}@raiz.test`;
  emails.push(email);

  const registro = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    remoteAddress: proximoIp(),
    payload: { nome: `Teste ${sufixo}`, email, senha: 'senha-de-teste' },
  });
  expect(registro.statusCode).toBe(201);
  const { accessToken, usuario } = registro.json();
  const auth = { authorization: `Bearer ${accessToken}` };

  const categoria = await app.inject({
    method: 'POST',
    url: '/api/categories',
    headers: auth,
    payload: { nome: 'Alimentação', tipo: 'SAIDA', cor: '#d67f48', orcamentoMensal: 1500 },
  });
  const conta = await app.inject({
    method: 'POST',
    url: '/api/accounts',
    headers: auth,
    payload: { nome: 'Banco', tipo: 'CORRENTE', dono: 'Teste', saldo: 1000 },
  });
  const cartao = await app.inject({
    method: 'POST',
    url: '/api/cards',
    headers: auth,
    payload: {
      nome: 'Cartão',
      bandeira: 'VISA',
      final: '1234',
      limite: 5000,
      diaFechamento: 28,
      diaVencimento: 8,
    },
  });

  return {
    email,
    accessToken,
    householdId: usuario.householdId,
    categoriaId: categoria.json().id,
    accountId: conta.json().id,
    cardId: cartao.json().id,
  };
}

const auth = (casa: Casa) => ({ authorization: `Bearer ${casa.accessToken}` });

beforeAll(async () => {
  if (!bancoDisponivel) return;
  app = buildApp({ env, logger: false, prisma });
  await app.ready();
});

afterAll(async () => {
  if (bancoDisponivel) {
    // Limpa só o que estes testes criaram — o seed fica intacto.
    const users = await prisma.user.findMany({ where: { email: { in: emails } } });
    await prisma.household.deleteMany({
      where: { id: { in: users.map((u) => u.householdId) } },
    });
    await app?.close();
  }
  await prisma.$disconnect();
});

// ────────────────────────────────────────────────────────────────── auth

suite('autenticação', () => {
  it('registra, devolve access token e grava o cookie de refresh httpOnly', async () => {
    const email = `novo-${Date.now()}@raiz.test`;
    emails.push(email);
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      remoteAddress: proximoIp(),
      payload: { nome: 'Novo', email, senha: 'senha-de-teste' },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().accessToken).toBeTruthy();
    expect(res.json().usuario.email).toBe(email);

    const cookie = res.cookies.find((c) => c.name === 'raiz_refresh');
    expect(cookie).toBeDefined();
    expect(cookie!.httpOnly).toBe(true);
    // Restrito a /api/auth: nenhuma outra rota precisa receber o refresh.
    expect(cookie!.path).toBe('/api/auth');
    expect(cookie!.sameSite?.toLowerCase()).toBe('lax');
  });

  it('recusa e-mail já cadastrado com 409', async () => {
    const casa = await criarCasa('dup');
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      remoteAddress: proximoIp(),
      payload: { nome: 'Outro', email: casa.email, senha: 'senha-de-teste' },
    });
    expect(res.statusCode).toBe(409);
  });

  it('não devolve o hash da senha em nenhuma resposta', async () => {
    const casa = await criarCasa('hash');
    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: auth(casa) });
    expect(JSON.stringify(me.json())).not.toContain('scrypt$');
    expect(me.json().usuario.senhaHash).toBeUndefined();
  });

  it('dá a mesma resposta para e-mail inexistente e senha errada', async () => {
    const casa = await criarCasa('login');
    const senhaErrada = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      remoteAddress: proximoIp(),
      payload: { email: casa.email, senha: 'errada' },
    });
    const emailInexistente = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      remoteAddress: proximoIp(),
      payload: { email: 'ninguem@raiz.test', senha: 'errada' },
    });

    expect(senhaErrada.statusCode).toBe(401);
    expect(emailInexistente.statusCode).toBe(401);
    // Mesma mensagem: não dá para enumerar quais e-mails existem.
    expect(senhaErrada.json().message).toBe(emailInexistente.json().message);
  });

  it('bloqueia rota protegida sem token, com token inválido e com token de outro segredo', async () => {
    const semToken = await app.inject({ method: 'GET', url: '/api/accounts' });
    const lixo = await app.inject({
      method: 'GET',
      url: '/api/accounts',
      headers: { authorization: 'Bearer nao-e-um-jwt' },
    });
    expect(semToken.statusCode).toBe(401);
    expect(lixo.statusCode).toBe(401);
  });

  it('rotaciona o refresh token e invalida o anterior', async () => {
    const email = `rot-${Date.now()}@raiz.test`;
    emails.push(email);
    const registro = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      remoteAddress: proximoIp(),
      payload: { nome: 'Rot', email, senha: 'senha-de-teste' },
    });
    const primeiro = registro.cookies.find((c) => c.name === 'raiz_refresh')!.value;

    const refresh = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      cookies: { raiz_refresh: primeiro },
    });
    expect(refresh.statusCode).toBe(200);
    const segundo = refresh.cookies.find((c) => c.name === 'raiz_refresh')!.value;
    expect(segundo).not.toBe(primeiro);

    // Reusar o token antigo é sinal de roubo: derruba tudo.
    const reuso = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      cookies: { raiz_refresh: primeiro },
    });
    expect(reuso.statusCode).toBe(401);

    // E o token novo também deixa de valer, porque as sessões foram revogadas.
    const depois = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      cookies: { raiz_refresh: segundo },
    });
    expect(depois.statusCode).toBe(401);
  });

  it('logout revoga a sessão', async () => {
    const email = `out-${Date.now()}@raiz.test`;
    emails.push(email);
    const registro = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      remoteAddress: proximoIp(),
      payload: { nome: 'Out', email, senha: 'senha-de-teste' },
    });
    const token = registro.cookies.find((c) => c.name === 'raiz_refresh')!.value;

    const logout = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      cookies: { raiz_refresh: token },
    });
    expect(logout.statusCode).toBe(204);

    const depois = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      cookies: { raiz_refresh: token },
    });
    expect(depois.statusCode).toBe(401);
  });
});

// ──────────────────────────────────────────── isolamento entre households

suite('isolamento entre households', () => {
  let casaA: Casa;
  let casaB: Casa;

  beforeAll(async () => {
    casaA = await criarCasa('a');
    casaB = await criarCasa('b');
  });

  it('cada casa começa com household distinto', () => {
    expect(casaA.householdId).not.toBe(casaB.householdId);
  });

  it('a listagem só traz o que é da própria casa', async () => {
    const contasA = await app.inject({ method: 'GET', url: '/api/accounts', headers: auth(casaA) });
    const contasB = await app.inject({ method: 'GET', url: '/api/accounts', headers: auth(casaB) });

    const idsA = contasA.json().map((c: { id: string }) => c.id);
    const idsB = contasB.json().map((c: { id: string }) => c.id);
    expect(idsA).toContain(casaA.accountId);
    expect(idsA).not.toContain(casaB.accountId);
    expect(idsB).toContain(casaB.accountId);
    expect(idsB).not.toContain(casaA.accountId);
  });

  it('não lê, não altera e não apaga registro da outra casa — sempre 404', async () => {
    const alvos = [
      { url: `/api/accounts/${casaB.accountId}`, payload: { nome: 'X', tipo: 'CORRENTE', dono: 'X', saldo: 1 } },
      { url: `/api/cards/${casaB.cardId}`, payload: { nome: 'X', bandeira: 'VISA', final: '9999', limite: 1, diaFechamento: 1, diaVencimento: 2 } },
      { url: `/api/categories/${casaB.categoriaId}`, payload: { nome: 'X', tipo: 'SAIDA', cor: '#d67f48', orcamentoMensal: 1 } },
    ];

    for (const alvo of alvos) {
      const put = await app.inject({
        method: 'PUT',
        url: alvo.url,
        headers: auth(casaA),
        payload: alvo.payload,
      });
      const del = await app.inject({ method: 'DELETE', url: alvo.url, headers: auth(casaA) });
      // 404, não 403: um 403 confirmaria que o id existe em algum lugar.
      expect(put.statusCode, `PUT ${alvo.url}`).toBe(404);
      expect(del.statusCode, `DELETE ${alvo.url}`).toBe(404);
    }
  });

  it('não cria lançamento apontando para categoria ou conta da outra casa', async () => {
    const comCategoriaAlheia = await app.inject({
      method: 'POST',
      url: '/api/transactions',
      headers: auth(casaA),
      payload: {
        descricao: 'Invasor',
        valor: 100,
        data: '2026-08-10',
        tipo: 'SAIDA',
        categoriaId: casaB.categoriaId,
        accountId: casaA.accountId,
        responsavel: 'ANA',
      },
    });
    expect(comCategoriaAlheia.statusCode).toBe(404);

    const comContaAlheia = await app.inject({
      method: 'POST',
      url: '/api/transactions',
      headers: auth(casaA),
      payload: {
        descricao: 'Invasor',
        valor: 100,
        data: '2026-08-10',
        tipo: 'SAIDA',
        categoriaId: casaA.categoriaId,
        accountId: casaB.accountId,
        responsavel: 'ANA',
      },
    });
    expect(comContaAlheia.statusCode).toBe(404);
  });

  it('a fatura de um cartão alheio não é acessível', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/cards/${casaB.cardId}/invoice?mes=2026-08`,
      headers: auth(casaA),
    });
    expect(res.statusCode).toBe(404);
  });

  it('o dashboard de uma casa não soma valores da outra', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/transactions',
      headers: auth(casaB),
      payload: {
        descricao: 'Só da casa B',
        valor: 999,
        data: '2026-08-10',
        tipo: 'SAIDA',
        categoriaId: casaB.categoriaId,
        accountId: casaB.accountId,
        responsavel: 'ANA',
      },
    });

    const dashA = await app.inject({
      method: 'GET',
      url: '/api/dashboard?mes=2026-08',
      headers: auth(casaA),
    });
    expect(dashA.json().kpis.saidas).toBe(0);
  });
});

// ──────────────────────────────────────────────────────── validação

suite('validação', () => {
  let casa: Casa;
  beforeAll(async () => {
    casa = await criarCasa('val');
  });

  it('recusa valor zero ou negativo com 422 e erro por campo', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/transactions',
      headers: auth(casa),
      payload: {
        descricao: 'Grátis',
        valor: 0,
        data: '2026-08-10',
        tipo: 'SAIDA',
        categoriaId: casa.categoriaId,
        accountId: casa.accountId,
        responsavel: 'ANA',
      },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().campos.valor).toBeTruthy();
  });

  it('aceita valor digitado no formato pt-BR', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/transactions',
      headers: auth(casa),
      payload: {
        descricao: 'Mercado',
        valor: '1.234,56',
        data: '2026-08-11',
        tipo: 'SAIDA',
        categoriaId: casa.categoriaId,
        accountId: casa.accountId,
        responsavel: 'ANA',
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().valor).toBeCloseTo(1234.56, 2);
  });

  it('exige conta OU cartão, nunca os dois nem nenhum', async () => {
    const base = {
      descricao: 'Teste',
      valor: 50,
      data: '2026-08-12',
      tipo: 'SAIDA',
      categoriaId: casa.categoriaId,
      responsavel: 'ANA',
    };
    const nenhum = await app.inject({
      method: 'POST',
      url: '/api/transactions',
      headers: auth(casa),
      payload: base,
    });
    const ambos = await app.inject({
      method: 'POST',
      url: '/api/transactions',
      headers: auth(casa),
      payload: { ...base, accountId: casa.accountId, cardId: casa.cardId },
    });
    expect(nenhum.statusCode).toBe(422);
    expect(ambos.statusCode).toBe(422);
  });

  it('recusa prazo de meta não inteiro e taxa fora de −100..100', async () => {
    const meta = await app.inject({
      method: 'POST',
      url: '/api/goals',
      headers: auth(casa),
      payload: { nome: 'Meta', alvo: 1000, atual: 0, prazoMeses: 2.5 },
    });
    const ativo = await app.inject({
      method: 'POST',
      url: '/api/assets',
      headers: auth(casa),
      payload: {
        nome: 'Ativo',
        classe: 'RENDA_FIXA',
        valor: 1000,
        taxaAnual: 250,
        aporteMensal: 0,
        metaTaxa: 10,
      },
    });
    expect(meta.statusCode).toBe(422);
    expect(ativo.statusCode).toBe(422);
  });

  it('recusa competência malformada', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/dashboard?mes=agosto',
      headers: auth(casa),
    });
    expect(res.statusCode).toBe(422);
  });
});

// ──────────────────────────────────────────────── integridade referencial

suite('integridade ao excluir', () => {
  let casa: Casa;
  beforeAll(async () => {
    casa = await criarCasa('del');
    await app.inject({
      method: 'POST',
      url: '/api/transactions',
      headers: auth(casa),
      payload: {
        descricao: 'Compra',
        valor: 100,
        data: '2026-08-15',
        tipo: 'SAIDA',
        categoriaId: casa.categoriaId,
        accountId: casa.accountId,
        responsavel: 'ANA',
      },
    });
  });

  it('não deixa excluir categoria que ainda classifica lançamentos', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/categories/${casa.categoriaId}`,
      headers: auth(casa),
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().message).toMatch(/lançamento/i);
  });

  it('não deixa excluir conta que ainda tem lançamentos', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/accounts/${casa.accountId}`,
      headers: auth(casa),
    });
    expect(res.statusCode).toBe(409);
  });

  it('recusa lançamento duplicado — mesma data, valor e descrição', async () => {
    const payload = {
      descricao: 'Compra',
      valor: 100,
      data: '2026-08-15',
      tipo: 'SAIDA',
      categoriaId: casa.categoriaId,
      accountId: casa.accountId,
      responsavel: 'ANA',
    };
    const res = await app.inject({
      method: 'POST',
      url: '/api/transactions',
      headers: auth(casa),
      payload,
    });
    expect(res.statusCode).toBe(409);
  });
});
