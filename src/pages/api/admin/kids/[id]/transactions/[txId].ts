import type { APIRoute } from 'astro';
import { requireParentUser } from '../../../../../../lib/auth';
import { getOwnedKid, getTransaction, updateTransaction, deleteTransaction } from '../../../../../../lib/data';
import { parseMoneyInput, parseTransactionDate } from '../../../../../../lib/money';
import type { CurrencyCode } from '../../../../../../lib/models';

export const POST: APIRoute = async ({ params, request, cookies, redirect }) => {
  const parent = await requireParentUser(cookies);
  if (!parent) return new Response('Forbidden', { status: 403 });
  const kid = params.id ? await getOwnedKid(parent.id, params.id) : null;
  const existing = kid && params.txId ? await getTransaction(kid.id, params.txId) : null;
  if (!kid || !existing) return new Response('Not found', { status: 404 });

  const form = await request.formData();
  const redirectToRaw = String(form.get('redirectTo') || '/admin');
  const redirectTo = redirectToRaw.startsWith('/') && !redirectToRaw.startsWith('//') ? redirectToRaw : '/admin';
  const method = String(form.get('_method') || 'PATCH').toUpperCase();

  if (method === 'DELETE') {
    await deleteTransaction(kid.id, params.txId!);
    return redirect(redirectTo + '?ok=' + encodeURIComponent(`Deleted transaction for ${kid.name}.`));
  }

  const amount = parseMoneyInput(String(form.get('amount') || ''));
  const memoRaw = String(form.get('memo') || '').trim();
  const memo = memoRaw ? memoRaw.slice(0, 200) : null;
  const categoryRaw = String(form.get('category') || '').trim();
  const category = categoryRaw ? categoryRaw.slice(0, 80) : null;
  const parentPaid = form.get('parentPaid') === 'yes';
  const currencyRaw = String(form.get('currency') || 'CAD');
  const currency: CurrencyCode = currencyRaw === 'ILS' ? 'ILS' : 'CAD';
  const createdAt = parseTransactionDate(String(form.get('date') || ''));

  if (amount === null || amount === 0 || !Number.isSafeInteger(amount) || Math.abs(amount) > 2147483647) {
    return redirect(redirectTo + '?error=' + encodeURIComponent('Enter a non-zero amount (positive or negative).'));
  }
  if (createdAt === undefined) {
    return redirect(redirectTo + '?error=' + encodeURIComponent('Enter a valid date (not in the future).'));
  }

  await updateTransaction(kid.id, params.txId!, {amountCents: amount, memo, category, parentPaid, currency, createdAt: createdAt ?? existing.createdAt});
  return redirect(redirectTo + '?ok=' + encodeURIComponent(`Updated transaction for ${kid.name}.`));
};
