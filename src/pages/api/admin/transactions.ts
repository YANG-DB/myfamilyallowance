import { addTransaction } from '../../../lib/data';
import type { APIRoute } from 'astro';
import { requireParentUser } from '../../../lib/auth';
import { getOwnedKid } from '../../../lib/data';
import { parseMoneyInput, parseTransactionDate } from '../../../lib/money';
import type { CurrencyCode } from '../../../lib/models';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const user = await requireParentUser(cookies);
  if (!user) {
    return redirect('/auth/google');
  }

  const form = await request.formData();
  const kidId = String(form.get('kidId') || '');
  const amount = parseMoneyInput(String(form.get('amount') || ''));
  const memoRaw = String(form.get('memo') || '').trim();
  const memo = memoRaw ? memoRaw.slice(0, 200) : null;
  const currencyRaw = String(form.get('currency') || 'CAD');
  const currency: CurrencyCode = currencyRaw === 'ILS' ? 'ILS' : 'CAD';
  const createdAt = parseTransactionDate(String(form.get('date') || ''));
  const categoryRaw = String(form.get('category') || '').trim();
  const category = categoryRaw ? categoryRaw.slice(0, 80) : null;

  if (!kidId) {
    return redirect('/admin?error=' + encodeURIComponent('Missing kid.'));
  }

  const owned = await getOwnedKid(user.id, kidId);
  if (!owned) {
    return new Response('Forbidden', { status: 403 });
  }

  if (amount === null || amount === 0 || !Number.isSafeInteger(amount) || Math.abs(amount) > 2147483647) {
    return redirect(
      '/admin?error=' + encodeURIComponent('Enter a non-zero amount (positive or negative).'),
    );
  }
  if (createdAt === undefined) {
    return redirect('/admin?error=' + encodeURIComponent('Enter a valid date (not in the future).'));
  }

  await addTransaction({kidId, amountCents: amount, memo, category, fromAllowance: false, currency, createdAt: createdAt ?? undefined});

  return redirect('/admin?ok=' + encodeURIComponent(`Saved transaction for ${owned.name}.`));
};
