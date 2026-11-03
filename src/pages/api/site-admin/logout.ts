import type { APIRoute } from 'astro';
import { clearSiteAdminSession } from '../../../lib/auth';

export const POST: APIRoute = async ({ cookies, redirect }) => {
  clearSiteAdminSession(cookies);
  return redirect('/site-admin');
};
