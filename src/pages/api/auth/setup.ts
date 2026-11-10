import type { APIRoute } from 'astro';
import { allowLoginAttempt } from '../../../lib/login-limit';
import { initializeOwner } from '../../../lib/accounts';
import { validPassword } from '../../../lib/passwords';
import { setParentSession } from '../../../lib/auth';
export const POST: APIRoute = async ({request,cookies,redirect,clientAddress}) => {
  const address=request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() || clientAddress;
  if (!await allowLoginAttempt(address,'initial-setup')) return new Response('Too many attempts. Try again in 15 minutes.',{status:429});
  const form=await request.formData();const email=String(form.get('email') || '').trim().toLowerCase();
  const password=String(form.get('password') || '');const token=String(form.get('setupToken') || '');
  if (!validPassword(password) || password !== form.get('confirmPassword')) return redirect('/setup?error=Use%20matching%20passwords%20of%2012%E2%80%93128%20characters.',303);
  const owner=token.length <= 256 ? await initializeOwner(email,password,token) : null;
  if (!owner) return redirect('/setup?error=Setup%20is%20unavailable%20or%20the%20details%20are%20incorrect.',303);
  await setParentSession(cookies,owner,email);return redirect('/admin',303);
};
