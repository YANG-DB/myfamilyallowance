import { parseMonthlyLimit } from '../../../../lib/spending';
import { updateKid, deleteKid } from '../../../../lib/data';
import type { APIRoute } from 'astro';
import { requireParentUser } from '../../../../lib/auth';
import { getOwnedKid } from '../../../../lib/data';
import { parseMoneyInput } from '../../../../lib/money';

export const POST: APIRoute = async ({ params, request, cookies, redirect }) => {
  const user = await requireParentUser(cookies);
  if (!user) {
    return redirect('/auth/google');
  }

  const kidId = params.id;
  if (!kidId) {
    return redirect('/admin?error=' + encodeURIComponent('Missing kid id.'));
  }

  const owned = await getOwnedKid(user.id, kidId);
  if (!owned) {
    return new Response('Forbidden', { status: 403 });
  }

  const form = await request.formData();
  const method = String(form.get('_method') || 'PATCH').toUpperCase();

  if (method === 'DELETE') {
    await deleteKid(owned);
    return redirect('/admin?ok=' + encodeURIComponent('Kid deleted.'));
  }

  const name = String(form.get('name') || '').trim();
  const monthlyAllowance = parseMoneyInput(String(form.get('monthlyAllowance') || ''));
  const monthly = parseMonthlyLimit(String(form.get('monthlySpendingLimit') || ''));
  if (monthly === undefined) return redirect('/admin?error=' + encodeURIComponent('Enter a valid monthly spending amount, or leave it blank for no limit.'));

  if (!name || name.length > 80) {
    return redirect('/admin?error=' + encodeURIComponent('Enter a kid name (max 80 characters).'));
  }
  if (monthlyAllowance === null || monthlyAllowance < 0) {
    return redirect('/admin?error=' + encodeURIComponent('Enter a valid monthly allowance.'));
  }

  await updateKid(owned, {name, monthlyAllowanceCents: monthlyAllowance, monthlySpendingLimitCents: monthly});

  return redirect('/admin?ok=' + encodeURIComponent('Kid updated.'));
};
