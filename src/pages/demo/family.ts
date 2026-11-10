import type { APIRoute } from 'astro';
import { demoMode } from '../../lib/demo';
import { clearParentSession, clearFamilySession } from '../../lib/auth';
export const GET: APIRoute = ({cookies, redirect}) => {
  if (!demoMode) return new Response('Not found', {status: 404});
  clearParentSession(cookies);
  clearFamilySession(cookies);
  return redirect('/kid-login');
};
