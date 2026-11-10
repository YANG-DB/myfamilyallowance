import { randomBytes, randomInt, scrypt, scryptSync, timingSafeEqual } from 'node:crypto';
function derive(password: string, salt: string) {
  return new Promise<Buffer>((resolve,reject) => {
    scrypt(password,salt,64,options,(error,key) => error ? reject(error) : resolve(key));
  });
}
const options = {N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024};
const PREFIX = 'scrypt$131072$8$1';
export function validPassword(password: string) { return password.length >= 12 && password.length <= 128; }
// Excludes 0/O, 1/I/L to avoid lookalikes when typed by hand. Each char is drawn uniformly via
// randomInt (rejection sampling, no modulo bias) — 4 groups of 4 chars is ~79 bits of entropy
// from the CSPRNG, strong even if an attacker has read this generator's source, since security
// here comes from the random draws, not from any secrecy of the scheme.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export function generatePassword(groups = 4, groupLength = 4) {
  const chunks: string[] = [];
  for (let g = 0; g < groups; g++) {
    let chunk = '';
    for (let c = 0; c < groupLength; c++) chunk += ALPHABET[randomInt(ALPHABET.length)];
    chunks.push(chunk);
  }
  return chunks.join('-');
}
export function hashDemoPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `${PREFIX}$${salt}$${scryptSync(password, salt, 64, options).toString('hex')}`;
}
export async function hashPassword(password: string) {
  if (!validPassword(password)) throw new Error('Use a password of 12–128 characters.');
  const salt = randomBytes(16).toString('hex');
  const key = await derive(password, salt);
  return `${PREFIX}$${salt}$${key.toString('hex')}`;
}
// A fixed non-account hash makes nonexistent-account checks perform the same work.
const dummy = `${PREFIX}$00000000000000000000000000000000$${'0'.repeat(128)}`;
export async function verifyPassword(password: string, encoded?: string | null) {
  if (password.length > 128) return false;
  const candidate = encoded ?? dummy;
  const parts = candidate.split('$');
  if (parts.length !== 6 || parts.slice(0,4).join('$') !== PREFIX || !/^[a-f0-9]{32}$/.test(parts[4]) || !/^[a-f0-9]{128}$/.test(parts[5])) return false;
  const key = await derive(password, parts[4]);
  const matches = timingSafeEqual(key, Buffer.from(parts[5], 'hex'));
  return Boolean(encoded) && matches;
}
