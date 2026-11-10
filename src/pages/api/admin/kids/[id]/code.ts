import type { APIRoute } from 'astro';
export const POST: APIRoute = () => new Response('Access codes have been replaced by individual passwords.',{status:410});
