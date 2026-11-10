import type { APIRoute } from 'astro';
import { requireParentUser } from '../../../../../lib/auth';
import { getOwnedKid } from '../../../../../lib/data';
import { setKidPassword } from '../../../../../lib/accounts';
import { validPassword } from '../../../../../lib/passwords';
export const POST: APIRoute = async ({params,request,cookies,redirect}) => {
  const parent=await requireParentUser(cookies);if (!parent) return new Response('Forbidden',{status:403});
  const kid=params.id ? await getOwnedKid(parent.id,params.id) : null;
  if (!kid) return new Response('Not found',{status:404});
  const form=await request.formData();const action=form.get('action');
  if (action !== 'save' && action !== 'revoke') return new Response('Invalid action',{status:400});
  const password=String(form.get('password') || '');
  if (action === 'save' && (!validPassword(password) || password !== form.get('confirmPassword'))) return redirect('/admin?error=Use%20matching%20passwords%20of%2012%E2%80%93128%20characters.',303);
  await setKidPassword(kid,action==='revoke'?null:password);
  return redirect(action==='revoke'?'/admin?ok=Kid%20sign-in%20disabled.':'/admin?ok=Kid%20password%20saved.%20Previous%20sessions%20are%20signed%20out.',303);
};
