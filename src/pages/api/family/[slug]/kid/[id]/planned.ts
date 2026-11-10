import type { APIRoute } from 'astro';
import { getAccessibleKid } from '../../../../../../lib/auth';
import { addPlannedItem } from '../../../../../../lib/data';
import { parseMoneyInput } from '../../../../../../lib/money';
import { fetchLinkThumbnail } from '../../../../../../lib/linkPreview';
import type { CurrencyCode } from '../../../../../../lib/models';

export const POST: APIRoute = async ({ params, request, cookies, redirect }) => {
  const { slug, id } = params;
  if (!slug || !id || !/^[a-z0-9]{5}$/.test(slug)) return new Response('Not found', { status: 404 });
  const kid = await getAccessibleKid(cookies, slug, id);
  if (!kid) return new Response('Forbidden', { status: 403 });

  const path = `/f/${slug}/kid/${id}`;
  const form = await request.formData();
  const url = String(form.get('url') || '').trim();
  const description = String(form.get('description') || '').trim();
  const currencyRaw = String(form.get('currency') || 'CAD');
  const currency: CurrencyCode = currencyRaw === 'ILS' ? 'ILS' : 'CAD';
  const amount = parseMoneyInput(String(form.get('amount') || ''));

  let parsedUrl: URL;
  try { parsedUrl = new URL(url); } catch { parsedUrl = null as unknown as URL; }
  if (!parsedUrl || !['http:', 'https:'].includes(parsedUrl.protocol) || url.length > 2000) {
    return redirect(path + '?error=' + encodeURIComponent('Enter a valid http(s) link.') + '#planned-spending');
  }
  if (!description || description.length > 200) {
    return redirect(path + '?error=' + encodeURIComponent('Describe the planned purchase in 1–200 characters.') + '#planned-spending');
  }
  if (amount === null || amount < 1 || amount > 2147483647) {
    return redirect(path + '?error=' + encodeURIComponent('Enter a positive planned amount with up to two decimal places.') + '#planned-spending');
  }

  const thumbnailUrl = await fetchLinkThumbnail(url);
  await addPlannedItem({ kidId: kid.id, url, description, amountCents: amount, currency, thumbnailUrl });
  return redirect(path + '?ok=' + encodeURIComponent('Added to planned spending.') + '#planned-spending');
};
