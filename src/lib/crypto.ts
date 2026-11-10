import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { sessionSecret } from './secret';

// AES-256-GCM, not a one-way hash: the app needs to recover the address to actually send mail
// to it later. The key is derived from SESSION_SECRET (an env var, never committed to source),
// so reading this code — or a leaked Firestore export — doesn't reveal anyone's email.
function key() {
  return createHash('sha256').update(sessionSecret()).digest();
}

export function encryptEmail(email: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const ciphertext = Buffer.concat([cipher.update(email, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${ciphertext.toString('hex')}`;
}

export function decryptEmail(stored: string | null | undefined): string | null {
  if (!stored) return null;
  const parts = stored.split(':');
  if (parts.length !== 3) return null;
  try {
    const [ivHex, tagHex, dataHex] = parts;
    const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const plain = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
    return plain.toString('utf8');
  } catch {
    return null;
  }
}
