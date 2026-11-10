import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

// Not imported from ./demo on purpose: ./crypto (used for email encryption) depends on this
// module, and ./demo needs email encryption during its own seeding — importing demoMode from
// ./demo here would create a circular import between the two.
const demoMode = import.meta.env.DEV && import.meta.env.DEMO_MODE === 'true';

// A random secret generated on first run and persisted outside the repo (gitignored), instead
// of a literal string in source — so reading this code doesn't hand over the actual key.
const demoSecretPath = fileURLToPath(new URL('../../.demo-secret', import.meta.url));
let cachedDemoSecret: string | undefined;
function demoSecret(): string {
  if (cachedDemoSecret) return cachedDemoSecret;
  try {
    const existing = readFileSync(demoSecretPath, 'utf8').trim();
    if (existing.length >= 32) return (cachedDemoSecret = existing);
  } catch {
    // no file yet, or unreadable — generate a fresh one below
  }
  const generated = randomBytes(32).toString('hex');
  try { writeFileSync(demoSecretPath, generated, {mode: 0o600}); } catch { /* read-only filesystem: still usable for this process */ }
  return (cachedDemoSecret = generated);
}

export function sessionSecret() {
  const secret = process.env.SESSION_SECRET || import.meta.env.SESSION_SECRET || (demoMode ? demoSecret() : '');
  if (secret.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters');
  return secret;
}
