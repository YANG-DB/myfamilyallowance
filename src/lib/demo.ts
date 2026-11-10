import { hashDemoPassword, generatePassword } from './passwords';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Kid, PlannedItem, Transaction, User } from './models';
import { toCadCents } from './money';
import { encryptEmail } from './crypto';

// Starting income/expense figures per kid, kept out of source so they can be edited directly
// without a code change. Keyed by lowercase kid name (matches loginName). Positive amount =
// income, negative = expense; amount is in whole currency units (not cents).
type StarterEntry = {amount: number; currency: 'ILS' | 'CAD'; memo: string; date?: string};
const starterTransactionsPath = fileURLToPath(new URL('../../data/kids-transactions.json', import.meta.url));
function loadStarterTransactions(): Record<string, StarterEntry[]> {
  try {
    return JSON.parse(readFileSync(starterTransactionsPath, 'utf8'));
  } catch {
    return {};
  }
}

// Demo authentication and storage are never enabled in production builds.
export const demoMode = import.meta.env.DEV && import.meta.env.DEMO_MODE === 'true';
const now = new Date();
const ownerEmail = 'demo@example.com'; // plaintext, used to derive the login id and session claim only
const parent: User = {
  id: '11111111-1111-4111-8111-111111111111',
  email: ownerEmail, name: 'Demo Parent', familySlug: 'demo1',
  createdAt: now,
};
function seed() {
  const parentPassword = generatePassword();
  const generatedPasswords: Record<string, string> = {parents: parentPassword};
  const monthlyAllowances: Record<string, number> = {alex: 12000, sam: 10000, jamie: 8000, taylor: 4000};
  const family: Kid[] = ['Alex', 'Sam', 'Jamie', 'Taylor'].map((name, i) => {
    const loginName = name.toLowerCase();
    const plain = generatePassword();
    generatedPasswords[loginName] = plain;
    return {
      id: `33333333-3333-4333-8333-33333333333${i}`, userId: parent.id,
      avatarId: null, loginName, passwordVersion: 0, passwordHash: hashDemoPassword(plain),
      monthlySpendingLimitCents: null, name, monthlyAllowanceCents: monthlyAllowances[loginName] ?? 0, createdAt: now, updatedAt: now,
    };
  });
  const starterByKid = loadStarterTransactions();
  const starterRows: {kid: Kid; entry: StarterEntry}[] = family.flatMap(kid =>
    (starterByKid[kid.loginName] ?? []).map(entry => ({kid, entry})));
  const entries: Transaction[] = starterRows.map(({kid, entry}, i) => ({
    id: i + 1, kidId: kid.id, amountCents: Math.round(entry.amount * 100), memo: entry.memo,
    fromAllowance: false, currency: entry.currency,
    // Noon UTC avoids the date shifting a day when rendered in a different display timezone.
    // Entries with no known date are backdated well outside the current month so they never
    // get counted toward "this month's spending" — only dated entries should do that.
    createdAt: entry.date ? new Date(`${entry.date}T12:00:00Z`) : new Date(now.getTime() - 365 * 86400000 - (starterRows.length - i) * 60000),
  }));
  console.log('[demo] generated passwords (local dev only):', JSON.stringify(generatedPasswords, null, 2));

  const encryptedOwnerEmail = encryptEmail(ownerEmail);
  return {
    parents: [{id: createHash('sha256').update(ownerEmail).digest('hex'), userId: parent.id, email: encryptedOwnerEmail, passwordHash: hashDemoPassword(parentPassword) as string | null, passwordVersion: 0}],
    user: { ...parent, email: encryptedOwnerEmail }, kids: family, transactions: entries, nextId: entries.length + 1,
    plannedItems: [] as PlannedItem[], nextPlannedId: 1,
    generatedPasswords,
  };
}
const shared = globalThis as typeof globalThis & { familyAllowancePasswordDemo?: ReturnType<typeof seed> };
export const demo = demoMode ? (shared.familyAllowancePasswordDemo ??= seed()) : {} as ReturnType<typeof seed>;
export function demoBalance(kidId: string) {
  return demo.transactions.filter(tx => tx.kidId === kidId && !tx.parentPaid).reduce((total, tx) => total + toCadCents(tx.amountCents, tx.currency), 0);
}
