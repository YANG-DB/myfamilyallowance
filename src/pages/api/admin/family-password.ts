import type { APIRoute } from 'astro';
export const POST: APIRoute = () => new Response('Shared family passwords have been replaced by individual account passwords.', {status: 410});
