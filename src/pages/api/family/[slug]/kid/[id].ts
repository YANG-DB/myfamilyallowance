import { getMonthlySpending } from '../../../../../lib/spending';
import type { APIRoute } from 'astro';
import { getAccessibleKid } from '../../../../../lib/auth';
import { addTransaction } from '../../../../../lib/data';
import type { CurrencyCode } from '../../../../../lib/models';
import { parseTransactionDate, toCadCents } from '../../../../../lib/money';

export const POST: APIRoute = async ({ params, request, cookies, redirect }) => {
  const { slug, id } = params;
  if (!slug || !id || !/^[a-z0-9]{5}$/.test(slug)) {
    return new Response('Not found', { status: 404 });
  }
  const kid = await getAccessibleKid(cookies, slug, id);
  if (!kid) return new Response('Forbidden', {status: 403});

  const form = await request.formData();
  const type = String(form.get('type') || 'purchase') === 'gift' ? 'gift' : 'purchase';
  const raw = String(form.get('amount') || '').trim();
  const description = String(form.get('description') || '').trim();
  const location = String(form.get('location') || '').trim().slice(0, 200);
  const path = `/f/${slug}/kid/${id}`;
  const cents = Math.round(Number(raw) * 100);
  const currencyRaw = String(form.get('currency') || 'CAD');
  const currency: CurrencyCode = currencyRaw === 'ILS' ? 'ILS' : 'CAD';
  const dateRaw = String(form.get('date') || '');
  const createdAt = parseTransactionDate(dateRaw);
  const categoryRaw = String(form.get('category') || '').trim();
  const category = categoryRaw ? categoryRaw.slice(0, 80) : null;
  const noun = type === 'gift' ? 'gift' : 'purchase';
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw) || !Number.isSafeInteger(cents) || cents < 1 || cents > 2147483647) {
    return redirect(path + '?error=' + encodeURIComponent(`Enter a positive ${noun} amount with up to two decimal places.`));
  }
  if (!description || description.length > 200) {
    return redirect(path + '?error=' + encodeURIComponent(`Describe your ${noun} in 1–200 characters.`));
  }
  if (createdAt === undefined) {
    return redirect(path + '?error=' + encodeURIComponent('Enter a valid date (not in the future).'));
  }

  if (type === 'purchase') {
    const spent = await getMonthlySpending(kid.id);
    const cadCents = toCadCents(cents, currency);
    if (kid.monthlySpendingLimitCents != null && spent + cadCents > kid.monthlySpendingLimitCents && form.get('confirmOverLimit') !== 'yes') {
      const pending = new URLSearchParams({ purchaseAmount: raw, purchaseDescription: description, purchaseLocation: location, purchaseCurrency: currency, purchaseDate: dateRaw, purchaseCategory: category ?? '' });
      return redirect(path + '?' + pending.toString(), 303);
    }
  }

  const entry = {
    kidId: kid.id,
    amountCents: type === 'gift' ? cents : -cents,
    memo: type === 'purchase' && location ? `${description} — ${location}` : description,
    category: type === 'purchase' ? category : null,
    fromAllowance: false,
    currency,
    createdAt: createdAt ?? undefined,
  };
  try {
    await addTransaction(entry);
    console.log('[tx-debug] addTransaction resolved', JSON.stringify({kidId: kid.id, amountCents: entry.amountCents}));
  } catch (err) {
    console.error('[tx-debug] addTransaction THREW', err);
    return redirect(path + '?error=' + encodeURIComponent('Something went wrong saving that — please try again.'));
  }
  return redirect(path + '?ok=' + encodeURIComponent(type === 'gift' ? 'Gift added! Your balance is updated.' : 'Purchase added! Your balance is updated.'), 303);
};
