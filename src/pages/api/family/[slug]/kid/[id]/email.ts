import type { APIRoute } from 'astro';
import { getAccessibleKid, getSessionKid, getParentSession } from '../../../../../../lib/auth';
import { validEmail, getParentCredential } from '../../../../../../lib/accounts';
import { verifyPassword } from '../../../../../../lib/passwords';
import { allowLoginAttempt } from '../../../../../../lib/login-limit';
import { setKidEmail } from '../../../../../../lib/data';
import { decryptEmail } from '../../../../../../lib/crypto';

// Always returns JSON: the decrypted email is only ever revealed in this response, immediately
// after re-verifying a password in this same request — never pre-rendered into a page.
export const POST: APIRoute = async ({params,request,cookies,clientAddress}) => {
  const {slug,id}=params;
  const kid=slug && id ? await getAccessibleKid(cookies,slug,id) : null;
  if (!kid) return new Response(JSON.stringify({ok:false,error:'Forbidden'}),{status:403});

  const form=await request.formData();
  const password=String(form.get('password') || '');
  const hasEmailField=form.has('email');
  const emailInput=String(form.get('email') || '').trim().toLowerCase();

  const address=request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() || clientAddress;
  if (!await allowLoginAttempt(address,`kid-email:${kid.id}`)) {
    return new Response(JSON.stringify({ok:false,error:'Too many attempts. Try again in 15 minutes.'}),{status:429});
  }

  const sessionKid = await getSessionKid(cookies);
  let verified = false;
  if (sessionKid && sessionKid.id === kid.id) {
    verified = await verifyPassword(password, kid.passwordHash);
  } else {
    const parentSession = await getParentSession(cookies);
    const credential = parentSession ? await getParentCredential(parentSession.credentialId) : null;
    verified = credential ? await verifyPassword(password, credential.passwordHash) : false;
  }
  if (!verified) {
    return new Response(JSON.stringify({ok:false,error:'Incorrect password.'}),{status:401});
  }

  if (hasEmailField) {
    if (emailInput && !validEmail(emailInput)) {
      return new Response(JSON.stringify({ok:false,error:'Enter a valid email, or leave it blank.'}),{status:400});
    }
    await setKidEmail(kid, emailInput || null);
    return new Response(JSON.stringify({ok:true,email:emailInput || null}),{status:200});
  }

  return new Response(JSON.stringify({ok:true,email:decryptEmail(kid.email)}),{status:200});
};
