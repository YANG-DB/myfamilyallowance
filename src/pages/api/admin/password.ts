import type { APIRoute } from 'astro';
import { getParentSession, clearParentSession } from '../../../lib/auth';
import { getParentCredential, changeParentPassword } from '../../../lib/accounts';
import { allowLoginAttempt } from '../../../lib/login-limit';
import { validPassword, verifyPassword } from '../../../lib/passwords';
export const POST: APIRoute = async ({request,cookies,redirect,clientAddress}) => {
  const session=await getParentSession(cookies);if (!session) return new Response('Forbidden',{status:403});
  const credential=await getParentCredential(session.credentialId);if (!credential) return new Response('Forbidden',{status:403});
  const form=await request.formData();const password=String(form.get('password') || '');
  const address=request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() || clientAddress;
  if (!await allowLoginAttempt(address,`password-change:${credential.id}`)) return new Response('Too many attempts. Try again later.',{status:429});
  if (!await verifyPassword(String(form.get('currentPassword') || ''),credential.passwordHash)) return redirect('/admin?error=Current%20password%20is%20incorrect.',303);
  if (!validPassword(password) || password !== form.get('confirmPassword')) return redirect('/admin?error=Use%20matching%20passwords%20of%2012%E2%80%93128%20characters.',303);
  if (!await changeParentPassword(credential,password)) return redirect('/admin?error=Password%20changed%20in%20another%20session.%20Please%20sign%20in%20again.',303);
  clearParentSession(cookies);return redirect('/parent-login',303);
};
