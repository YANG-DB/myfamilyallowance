import { defineMiddleware } from 'astro:middleware';
export const onRequest = defineMiddleware(async ({request, url}, next) => {
  if (!['GET','HEAD','OPTIONS'].includes(request.method)) {
    const origin = request.headers.get('origin');
    const expected = process.env.SITE_URL || (import.meta.env.DEV ? url.origin : '');
    if (!origin || !expected || origin !== expected.replace(/\/$/, '')) return new Response('Forbidden origin', {status:403});
  }
  const response = await next();
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  // no-referrer can turn ordinary form POST Origin headers into 'null'.
  // same-origin keeps local form submissions verifiable without leaking referrers to other sites.
  response.headers.set('Referrer-Policy', 'same-origin');
  response.headers.set('X-Frame-Options', 'DENY');
  return response;
});
