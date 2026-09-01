import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

/**
 * Hash de senha com scrypt, do `node:crypto`.
 *
 * scrypt em vez de bcrypt/argon2 porque é nativo do Node: sem dependência com
 * binário compilado, o que evita a dor de build em serverless. Os parâmetros
 * abaixo são os padrões do Node (N=16384, r=8, p=1), adequados para senhas.
 *
 * Formato guardado: `scrypt$<salt em hex>$<hash em hex>`. O prefixo deixa espaço
 * para trocar de algoritmo depois sem invalidar as senhas existentes.
 */
const KEY_LENGTH = 64;
const PREFIX = 'scrypt';

export async function hashPassword(senha: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(senha, salt, KEY_LENGTH);
  return `${PREFIX}$${salt.toString('hex')}$${derived.toString('hex')}`;
}

/**
 * Compara em tempo constante. Devolve `false` — nunca lança — para hash
 * malformado, para não distinguir "usuário não existe" de "senha errada".
 */
export async function verifyPassword(senha: string, armazenado: string): Promise<boolean> {
  const partes = armazenado.split('$');
  if (partes.length !== 3 || partes[0] !== PREFIX) return false;

  const salt = Buffer.from(partes[1]!, 'hex');
  const esperado = Buffer.from(partes[2]!, 'hex');
  if (salt.length === 0 || esperado.length !== KEY_LENGTH) return false;

  const derived = await scrypt(senha, salt, KEY_LENGTH);
  return timingSafeEqual(derived, esperado);
}
