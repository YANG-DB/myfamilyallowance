import type { APIRoute } from 'astro';
import { getAccessibleKid } from '../../../../../../../lib/auth';
import { getPlannedItem, archivePlannedItem } from '../../../../../../../lib/data';

export const POST: APIRoute = async ({ params, request, cookies, redirect }) => {
  const { slug, id, plannedId } = params;
  if (!slug || !id || !/^[a-z0-9]{5}$/.test(slug)) return new Response('Not found', { status: 404 });
  const kid = await getAccessibleKid(cookies, slug, id);
  const item = kid && plannedId ? await getPlannedItem(kid.id, plannedId) : null;
  if (!kid || !item) return new Response('Not found', { status: 404 });

  const form = await request.formData();
  if (String(form.get('action') || '') !== 'archive') return new Response('Invalid action', { status: 400 });

  await archivePlannedItem(kid.id, plannedId!);
  return redirect(`/f/${slug}/kid/${id}?ok=` + encodeURIComponent('Archived planned item.') + '#planned-spending');
};
