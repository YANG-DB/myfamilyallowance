import { allTransactions } from './data';
import { toCadCents } from './money';
import { isParentPaidCategory } from './rules';
import type { Transaction } from './models';

// A calendar month in the family's current local timezone, including DST changes.
export const spendingTimeZone = 'America/Vancouver';
export function spendingMonth(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: spendingTimeZone, year: 'numeric', month: '2-digit',
  }).formatToParts(date);
  return `${parts.find(p => p.type === 'year')!.value}-${parts.find(p => p.type === 'month')!.value}`;
}
export function spendingYear(date = new Date()) {
  return new Intl.DateTimeFormat('en-US', { timeZone: spendingTimeZone, year: 'numeric' }).format(date);
}
export function isParentPaidTransaction(tx: Pick<Transaction, 'category' | 'parentPaid'>) {
  return !!tx.parentPaid || isParentPaidCategory(tx.category);
}
export async function getMonthlySpending(kidId: string, month = spendingMonth()) {
  return (await allTransactions(kidId))
    .filter(tx => tx.amountCents < 0 && spendingMonth(tx.createdAt) === month && !isParentPaidTransaction(tx))
    .reduce((total, tx) => total - toCadCents(tx.amountCents, tx.currency), 0);
}
export async function getYearlySpending(kidId: string, year = spendingYear()) {
  return (await allTransactions(kidId))
    .filter(tx => tx.amountCents < 0 && spendingYear(tx.createdAt) === year && !tx.parentPaid)
    .reduce((total, tx) => total - toCadCents(tx.amountCents, tx.currency), 0);
}
export type CategoryBreakdownRow = {category: string; cents: number; parentPaid: boolean};
export async function getMonthlyCategoryBreakdown(kidId: string, month = spendingMonth()): Promise<CategoryBreakdownRow[]> {
  const byCategory = new Map<string, {cents: number; parentPaid: boolean}>();
  for (const tx of await allTransactions(kidId)) {
    if (tx.amountCents >= 0 || spendingMonth(tx.createdAt) !== month) continue;
    const category = tx.category?.trim() || 'Uncategorized';
    const existing = byCategory.get(category) ?? {cents: 0, parentPaid: false};
    byCategory.set(category, {
      cents: existing.cents - toCadCents(tx.amountCents, tx.currency),
      parentPaid: existing.parentPaid || isParentPaidTransaction(tx),
    });
  }
  return [...byCategory.entries()]
    .map(([category, v]) => ({category, ...v}))
    .sort((a, b) => b.cents - a.cents);
}
function sameCategory(category: string | null | undefined, label: string) {
  return (category?.trim() || 'Uncategorized').toLowerCase() === label.toLowerCase();
}
export async function getCategoryTransactions(kidId: string, category: string): Promise<{items: Transaction[]; total: number}> {
  const items = (await allTransactions(kidId))
    .filter(tx => tx.amountCents < 0 && sameCategory(tx.category, category))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const total = items.reduce((sum, tx) => sum - toCadCents(tx.amountCents, tx.currency), 0);
  return {items, total};
}
export function parseMonthlyLimit(raw: string): number | null | undefined {
  const value = raw.trim();
  if (!value) return null; // No limit; zero is a valid limit.
  const cents = Math.round(Number(value) * 100);
  return /^\d+(?:\.\d{1,2})?$/.test(value) && Number.isSafeInteger(cents) && cents <= 2147483647 ? cents : undefined;
}
