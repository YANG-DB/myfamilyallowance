import type { CurrencyCode } from './models';

export function dollarsToCents(value: string | number): number | null {
  const raw = String(value).trim();
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(raw)) return null;
  const cents = Math.round(Number(raw) * 100);
  return Number.isSafeInteger(cents) && Math.abs(cents) <= 2147483647 ? cents : null;
}

export const defaultCurrency: CurrencyCode = 'CAD';
// Fixed rate, not a live feed: 1 CAD = 2.5 ILS.
const ILS_PER_CAD = 2.5;
const currencySymbols: Record<CurrencyCode, string> = { CAD: '$', ILS: '₪' };

export function toCadCents(amountCents: number, currency: CurrencyCode = defaultCurrency): number {
  return currency === 'ILS' ? Math.round(amountCents / ILS_PER_CAD) : amountCents;
}

export function formatMoney(cents: number, currency: CurrencyCode = defaultCurrency): string {
  const sign = cents < 0 ? '-' : '';
  return `${sign}${currencySymbols[currency]}${(Math.abs(cents) / 100).toFixed(2)}`;
}
export function parseMoneyInput(raw: string): number | null {
  return dollarsToCents(raw.trim().replace(/^[$₪]/, ''));
}
// null = no date given (caller should default to now); undefined = given but invalid/future.
export function parseTransactionDate(raw: string): Date | null | undefined {
  const value = raw.trim();
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const createdAt = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(createdAt.getTime()) || createdAt.getTime() > Date.now() + 86400000 ? undefined : createdAt;
}
