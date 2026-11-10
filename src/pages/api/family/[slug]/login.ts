import type { APIRoute } from 'astro';
export const POST: APIRoute = ({redirect}) => redirect('/kid-login', 303);
