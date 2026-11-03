import type { APIRoute } from 'astro';
import { setSiteAdminSession, verifySiteAdminPassword } from '../../../lib/auth';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const password = String(form.get('password') || '');

  if (!verifySiteAdminPassword(password)) {
    return redirect('/site-admin?error=' + encodeURIComponent('Incorrect password.'));
  }

  await setSiteAdminSession(cookies);
  return redirect('/site-admin');
};
