import type { APIRoute } from 'astro';
import { allowLoginAttempt } from '../../../lib/login-limit';
import { getParentCredential, parentId } from '../../../lib/accounts';
import { verifyPassword } from '../../../lib/passwords';
import { setParentSession } from '../../../lib/auth';
export const POST: APIRoute = async ({request,cookies,redirect,clientAddress}) => {
  const form=await request.formData();const email=String(form.get('email') || '').trim().toLowerCase();
  const password=String(form.get('password') || '');
  const address=request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() || clientAddress;
  if (!await allowLoginAttempt(address,`parent:${email.slice(0,254)}`)) return new Response('Too many attempts. Try again in 15 minutes.',{status:429,headers:{'Retry-After':'900'}});
  const credential=email.length <= 254 ? await getParentCredential(parentId(email)) : null;
  if (!await verifyPassword(password,credential?.passwordHash) || !credential) return redirect('/parent-login?error=Incorrect%20email%20or%20password.',303);
  await setParentSession(cookies,credential,email);return redirect('/admin',303);
};
