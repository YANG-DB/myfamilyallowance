import { parseMonthlyLimit } from '../../../../lib/spending';
import { createKid } from '../../../../lib/data';
import type { APIRoute } from 'astro';
import { requireParentUser } from '../../../../lib/auth';
import { parseMoneyInput } from '../../../../lib/money';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const user = await requireParentUser(cookies);
  if (!user) {
    return redirect('/auth/google');
  }

  const form = await request.formData();
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

  await createKid(user.id, name, monthlyAllowance, monthly);

  return redirect('/admin?ok=' + encodeURIComponent(`Added ${name}.`));
};
