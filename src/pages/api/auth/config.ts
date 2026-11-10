import type { APIRoute } from 'astro';
export const GET: APIRoute = () => new Response('Google sign-in has been replaced by passwords.',{status:410});
