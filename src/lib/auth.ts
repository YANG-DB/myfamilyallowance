import { createHash, timingSafeEqual } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { sealData, unsealData } from 'iron-session';
import type { AstroCookies } from 'astro';
import { db } from '../../db';
import { users, type User } from '../../db/schema';

const PARENT_COOKIE = 'mfa_parent';
const FAMILY_COOKIE = 'mfa_family';
const SITE_ADMIN_COOKIE = 'mfa_site_admin';
const OAUTH_STATE_COOKIE = 'mfa_oauth_state';

const PARENT_TTL = 60 * 60 * 24 * 14; // 14 days
const FAMILY_TTL = 60 * 60 * 24 * 7; // 7 days
const SITE_ADMIN_TTL = 60 * 60 * 24 * 7; // 7 days

export type ParentSession = {
  userId: string;
};

export type FamilySession = {
  slug: string;
  passwordVersion: number;
};

export type SiteAdminSession = {
  authenticated: true;
};

function sessionPassword(): string {
  const secret = import.meta.env.SESSION_SECRET || process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET must be set and at least 32 characters');
  }
  return secret;
}

function cookieSecure(): boolean {
  const site = import.meta.env.SITE_URL || process.env.SITE_URL || '';
  return site.startsWith('https://');
}

const baseCookie = {
  httpOnly: true,
  path: '/',
  sameSite: 'lax' as const,
};

export async function setParentSession(cookies: AstroCookies, session: ParentSession) {
  const sealed = await sealData(session, {
    password: sessionPassword(),
    ttl: PARENT_TTL,
  });
  cookies.set(PARENT_COOKIE, sealed, {
    ...baseCookie,
    secure: cookieSecure(),
    maxAge: PARENT_TTL,
  });
}

export async function getParentSession(cookies: AstroCookies): Promise<ParentSession | null> {
  const raw = cookies.get(PARENT_COOKIE)?.value;
  if (!raw) return null;
  try {
    return await unsealData<ParentSession>(raw, {
      password: sessionPassword(),
      ttl: PARENT_TTL,
    });
  } catch {
    return null;
  }
}

export function clearParentSession(cookies: AstroCookies) {
  cookies.delete(PARENT_COOKIE, { path: '/' });
}

export async function requireParentUser(cookies: AstroCookies): Promise<User | null> {
  const session = await getParentSession(cookies);
  if (!session?.userId) return null;
  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  return user ?? null;
}

export async function setFamilySession(cookies: AstroCookies, session: FamilySession) {
  const sealed = await sealData(session, {
    password: sessionPassword(),
    ttl: FAMILY_TTL,
  });
  cookies.set(FAMILY_COOKIE, sealed, {
    ...baseCookie,
    secure: cookieSecure(),
    maxAge: FAMILY_TTL,
  });
}

/** Sliding renewal: re-issue cookie so expiry pushes out another 7 days. */
export async function renewFamilySession(cookies: AstroCookies, session: FamilySession) {
  await setFamilySession(cookies, session);
}

export async function getFamilySession(cookies: AstroCookies): Promise<FamilySession | null> {
  const raw = cookies.get(FAMILY_COOKIE)?.value;
  if (!raw) return null;
  try {
    return await unsealData<FamilySession>(raw, {
      password: sessionPassword(),
      ttl: FAMILY_TTL,
    });
  } catch {
    return null;
  }
}

export function clearFamilySession(cookies: AstroCookies) {
  cookies.delete(FAMILY_COOKIE, { path: '/' });
}

/**
 * Validates family cookie for a slug. Renews on success (sliding window).
 * Returns the family owner user or null.
 */
export async function requireFamilyAccess(
  cookies: AstroCookies,
  slug: string,
): Promise<User | null> {
  // Parents signed in with Google can read their own family pages without the shared password.
  const parent = await requireParentUser(cookies);
  if (parent && parent.familySlug === slug) {
    return parent;
  }

  const session = await getFamilySession(cookies);
  if (!session || session.slug !== slug) return null;

  const [user] = await db.select().from(users).where(eq(users.familySlug, slug)).limit(1);
  if (!user) return null;
  if (session.passwordVersion !== user.familyPasswordVersion) {
    clearFamilySession(cookies);
    return null;
  }

  await renewFamilySession(cookies, {
    slug: user.familySlug,
    passwordVersion: user.familyPasswordVersion,
  });
  return user;
}

export function setOAuthState(cookies: AstroCookies, state: string) {
  cookies.set(OAUTH_STATE_COOKIE, state, {
    ...baseCookie,
    secure: cookieSecure(),
    maxAge: 60 * 10,
  });
}

export function consumeOAuthState(cookies: AstroCookies): string | null {
  const value = cookies.get(OAUTH_STATE_COOKIE)?.value ?? null;
  cookies.delete(OAUTH_STATE_COOKIE, { path: '/' });
  return value;
}

export function siteUrl(): string {
  const url = (import.meta.env.SITE_URL || process.env.SITE_URL || '').replace(/\/$/, '');
  if (!url) {
    throw new Error('SITE_URL must be set (e.g. http://localhost:8888)');
  }
  return url;
}

export function googleRedirectUri(): string {
  return (
    import.meta.env.GOOGLE_REDIRECT_URI ||
    process.env.GOOGLE_REDIRECT_URI ||
    `${siteUrl()}/auth/callback`
  );
}

export function verifySiteAdminPassword(input: string): boolean {
  const expected =
    import.meta.env.SITE_ADMIN_PASSWORD ||
    process.env.SITE_ADMIN_PASSWORD ||
    import.meta.env.ADMIN_PASSWORD ||
    process.env.ADMIN_PASSWORD ||
    '';
  if (!expected || !input) return false;
  const a = createHash('sha256').update(input).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function setSiteAdminSession(cookies: AstroCookies) {
  const sealed = await sealData<SiteAdminSession>(
    { authenticated: true },
    {
      password: sessionPassword(),
      ttl: SITE_ADMIN_TTL,
    },
  );
  cookies.set(SITE_ADMIN_COOKIE, sealed, {
    ...baseCookie,
    secure: cookieSecure(),
    maxAge: SITE_ADMIN_TTL,
  });
}

export async function requireSiteAdmin(cookies: AstroCookies): Promise<boolean> {
  const raw = cookies.get(SITE_ADMIN_COOKIE)?.value;
  if (!raw) return false;
  try {
    const data = await unsealData<SiteAdminSession>(raw, {
      password: sessionPassword(),
      ttl: SITE_ADMIN_TTL,
    });
    return data?.authenticated === true;
  } catch {
    return false;
  }
}

export function clearSiteAdminSession(cookies: AstroCookies) {
  cookies.delete(SITE_ADMIN_COOKIE, { path: '/' });
}
