import type { APIRoute } from 'astro';
import { requireParentUser } from '../../../../../../lib/auth';
import { getOwnedKid, deleteTransaction } from '../../../../../../lib/data';

export const POST: APIRoute = async ({ params, request, cookies, redirect }) => {
  const parent = await requireParentUser(cookies);
  if (!parent) return new Response('Forbidden', { status: 403 });
  const kid = params.id ? await getOwnedKid(parent.id, params.id) : null;
  if (!kid) return new Response('Not found', { status: 404 });

  const form = await request.formData();
  const redirectToRaw = String(form.get('redirectTo') || '/admin');
  const redirectTo = redirectToRaw.startsWith('/') && !redirectToRaw.startsWith('//') ? redirectToRaw : '/admin';
  const method = String(form.get('_method') || '').toUpperCase();
  if (method !== 'DELETE') return new Response('Invalid method', { status: 400 });

  const ids = form.getAll('txIds').map(String).filter(Boolean);
  if (ids.length === 0) {
    return redirect(redirectTo + '?error=' + encodeURIComponent('Select at least one transaction to delete.'));
  }
  await Promise.all(ids.map(id => deleteTransaction(kid.id, id)));
  return redirect(redirectTo + '?ok=' + encodeURIComponent(`Deleted ${ids.length} transaction${ids.length === 1 ? '' : 's'} for ${kid.name}.`));
};
