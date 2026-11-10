import type { APIRoute } from 'astro';
import { allowLoginAttempt } from '../../../lib/login-limit';
import { findKidByLogin } from '../../../lib/accounts';
import { verifyPassword } from '../../../lib/passwords';
import { setKidSession } from '../../../lib/auth';
import { getUser } from '../../../lib/data';
export const POST: APIRoute = async ({request,cookies,redirect,clientAddress}) => {
  const form=await request.formData();
  const login=String(form.get('username') || '').trim().toLowerCase();
  const password=String(form.get('password') || '');
  const address=request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() || clientAddress;
  if (!await allowLoginAttempt(address,`kid:${login.slice(0,80)}`)) return new Response('Too many attempts. Try again in 15 minutes.', {status:429,headers:{'Retry-After':'900'}});
  const kid=/^[a-z0-9-]{3,80}$/.test(login) ? await findKidByLogin(login) : null;
  const valid=await verifyPassword(password,kid?.passwordHash);
  const parent=valid && kid ? await getUser(kid.userId) : null;
  if (!kid || !parent || !valid) return redirect('/kid-login?error=Incorrect%20username%20or%20password.',303);
  await setKidSession(cookies,kid);
  return redirect(`/f/${parent.familySlug}/kid/${kid.id}`,303);
};
