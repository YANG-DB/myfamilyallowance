import type { AstroCookies } from 'astro';
import { sealData, unsealData } from 'iron-session';
import { demoMode } from './demo';
import { getParentCredential } from './accounts';
import { getUser, getKid } from './data';
import { sessionSecret as password } from './secret';
import type { Kid, User, ParentCredential } from './models';

const COOKIE = '__session'; // Firebase Hosting forwards only this cookie to Functions.
const KID_TTL = 60 * 60 * 24 * 7;
export function sessionOptions(maxAge: number) {
  return {httpOnly: true, path: '/', sameSite: 'lax' as const, secure: !import.meta.env.DEV, maxAge};
}
export async function getParentSession(cookies: AstroCookies): Promise<{userId: string; credentialId: string; email: string} | null> {
  const raw = cookies.get(COOKIE)?.value;
  if (!raw?.startsWith('parent:')) return null;
  try {
    const token = await unsealData<{role:string; credentialId:string; userId:string; version:number; email:string}>(raw.slice(7), {password:password(), ttl:KID_TTL});
    if (token.role !== 'parent' || !token.credentialId || !token.userId) return null;
    const credential = await getParentCredential(token.credentialId);
    if (!credential?.passwordHash || credential.passwordVersion !== token.version || credential.userId !== token.userId) return null;
    return {userId:credential.userId, credentialId:credential.id, email:token.email};
  } catch {return null;}
}
// email is the plaintext address just verified by the caller (e.g. at login) — it's sealed into
// the session token itself rather than re-read from storage, since the stored copy is encrypted
// at rest and this is the one moment we know the password was actually correct for it.
export async function setParentSession(cookies: AstroCookies, credential: ParentCredential, email: string) {
  const token = await sealData({role:'parent', credentialId:credential.id, userId:credential.userId, version:credential.passwordVersion, email}, {password:password(), ttl:KID_TTL});
  cookies.set(COOKIE, 'parent:' + token, sessionOptions(KID_TTL));
}
export async function requireParentUser(cookies: AstroCookies): Promise<User | null> {
  const session = await getParentSession(cookies);
  return session ? getUser(session.userId) : null;
}
export function clearParentSession(cookies: AstroCookies) { cookies.delete(COOKIE, {path: '/'}); }
export const clearFamilySession = clearParentSession;
export async function setKidSession(cookies: AstroCookies, kid: Kid) {
  const token = await sealData({role: 'kid', kidId: kid.id, userId: kid.userId, version: kid.passwordVersion}, {password: password(), ttl: KID_TTL});
  cookies.set(COOKIE, 'kid:' + token, sessionOptions(KID_TTL));
}
export async function getSessionKid(cookies: AstroCookies): Promise<Kid | null> {
  const raw = cookies.get(COOKIE)?.value;
  if (!raw?.startsWith('kid:')) return null;
  try {
    const token = await unsealData<{role: string; kidId: string; userId: string; version: number}>(raw.slice(4), {password: password(), ttl: KID_TTL});
    if (token.role !== 'kid' || !token.kidId || !token.userId) return null;
    const kid = await getKid(token.kidId);
    return kid && kid.userId === token.userId && kid.passwordHash && (kid.passwordVersion) === token.version ? kid : null;
  } catch { return null; }
}
export async function requireFamilyAccess(cookies: AstroCookies, slug: string) {
  const parent = await requireParentUser(cookies);
  return parent?.familySlug === slug ? parent : null;
}
export async function getAccessibleKid(cookies: AstroCookies, slug: string, id: string): Promise<Kid | null> {
  const parent = await requireFamilyAccess(cookies, slug);
  const kid = parent ? await getKid(id) : await getSessionKid(cookies);
  if (!kid || kid.id !== id) return null;
  const owner = parent ?? await getUser(kid.userId);
  return owner?.familySlug === slug && owner.id === kid.userId ? kid : null;
}
export function siteUrl() {
  return (process.env.SITE_URL || import.meta.env.SITE_URL || (demoMode ? 'http://localhost:8888' : '')).replace(/\/$/, '');
}
