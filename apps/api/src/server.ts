import { buildApp } from './app.js';
import { loadEnv } from './env.js';

/** Entrada do desenvolvimento local. Na Vercel quem entra é `api/index.ts`. */
const env = loadEnv();
const app = buildApp({ env });

try {
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
