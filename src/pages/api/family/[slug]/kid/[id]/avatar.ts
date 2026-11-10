import type { APIRoute } from 'astro';
import { getAccessibleKid } from '../../../../../../lib/auth';
import { isAvatarId } from '../../../../../../lib/avatars';
import { setKidAvatar } from '../../../../../../lib/data';
export const POST: APIRoute = async ({params,request,cookies,redirect}) => {
  const {slug,id}=params;
  const kid=slug && id ? await getAccessibleKid(cookies,slug,id) : null;
  if (!kid) return new Response('Forbidden',{status:403});
  const form=await request.formData();const avatarId=String(form.get('avatarId') || '');
  if (!isAvatarId(avatarId)) return redirect(`/f/${slug}/kid/${kid.id}/avatar?error=Choose%20a%20character%20from%20the%20list.`,303);
  await setKidAvatar(kid,avatarId);
  return redirect(`/f/${slug}/kid/${kid.id}?ok=Your%20character%20is%20saved!`,303);
};
