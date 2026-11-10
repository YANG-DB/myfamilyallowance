import type { APIRoute } from 'astro';
import { requireParentUser } from '../../../lib/auth';
import { addParent, validEmail } from '../../../lib/accounts';
import { validPassword } from '../../../lib/passwords';
export const POST: APIRoute = async ({request,cookies,redirect}) => {
  const parent=await requireParentUser(cookies);if (!parent) return new Response('Forbidden',{status:403});
  const form=await request.formData();const email=String(form.get('email') || '').trim().toLowerCase();
  const password=String(form.get('password') || '');
  if (!validEmail(email) || !validPassword(password) || password !== form.get('confirmPassword')) return redirect('/admin?error=Enter%20a%20valid%20email%20and%20matching%20passwords%20of%2012%E2%80%93128%20characters.',303);
  const added=await addParent(parent.id,email,password);
  return redirect(added?'/admin?ok=Parent%20account%20added.':'/admin?error=That%20email%20already%20has%20an%20account.',303);
};
