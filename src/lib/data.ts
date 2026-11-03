import { and, desc, eq, gte, sql, sum } from 'drizzle-orm';
import { db } from '../../db';
import { kids, transactions, users, type Kid, type User } from '../../db/schema';
import { generateFamilySlug } from './slug';

export async function findOrCreateUserFromGoogle(input: {
  googleSub: string;
  email: string;
  name: string;
}): Promise<User> {
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.googleSub, input.googleSub))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(users)
      .set({ email: input.email, name: input.name })
      .where(eq(users.id, existing.id))
      .returning();
    return updated!;
  }

  for (let attempt = 0; attempt < 8; attempt++) {
    const familySlug = generateFamilySlug(5);
    try {
      const [created] = await db
        .insert(users)
        .values({
          googleSub: input.googleSub,
          email: input.email,
          name: input.name,
          familySlug,
        })
        .returning();
      return created!;
    } catch {
      // slug collision — retry
    }
  }

  throw new Error('Could not allocate a unique family slug');
}

export async function getKidsWithBalances(userId: string) {
  const rows = await db
    .select({
      id: kids.id,
      name: kids.name,
      weeklyAllowanceCents: kids.weeklyAllowanceCents,
      createdAt: kids.createdAt,
      updatedAt: kids.updatedAt,
      balanceCents: sql<number>`coalesce(${sum(transactions.amountCents)}, 0)`.mapWith(Number),
    })
    .from(kids)
    .leftJoin(transactions, eq(transactions.kidId, kids.id))
    .where(eq(kids.userId, userId))
    .groupBy(kids.id)
    .orderBy(kids.name);

  return rows;
}

export async function getOwnedKid(userId: string, kidId: string): Promise<Kid | null> {
  const [kid] = await db
    .select()
    .from(kids)
    .where(and(eq(kids.id, kidId), eq(kids.userId, userId)))
    .limit(1);
  return kid ?? null;
}

export async function getKidBalance(kidId: string): Promise<number> {
  const [row] = await db
    .select({
      balanceCents: sql<number>`coalesce(${sum(transactions.amountCents)}, 0)`.mapWith(Number),
    })
    .from(transactions)
    .where(eq(transactions.kidId, kidId));
  return row?.balanceCents ?? 0;
}

export async function listTransactions(kidId: string, page: number, pageSize = 20) {
  const offset = Math.max(0, (page - 1) * pageSize);
  const rows = await db
    .select()
    .from(transactions)
    .where(eq(transactions.kidId, kidId))
    .orderBy(desc(transactions.createdAt), desc(transactions.id))
    .limit(pageSize + 1)
    .offset(offset);

  const hasMore = rows.length > pageSize;
  return {
    items: hasMore ? rows.slice(0, pageSize) : rows,
    hasMore,
    page,
    pageSize,
  };
}

export async function hasRecentAllowance(kidId: string, withinDays = 6): Promise<boolean> {
  const since = new Date(Date.now() - withinDays * 24 * 60 * 60 * 1000);
  const [row] = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(
      and(
        eq(transactions.kidId, kidId),
        eq(transactions.fromAllowance, true),
        gte(transactions.createdAt, since),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function getSiteStats() {
  const [[userRow], [kidRow], [txRow]] = await Promise.all([
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(users),
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(kids),
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(transactions),
  ]);

  return {
    users: userRow?.count ?? 0,
    kids: kidRow?.count ?? 0,
    transactions: txRow?.count ?? 0,
  };
}
