import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid().defaultRandom().primaryKey(),
  googleSub: text('google_sub').notNull().unique(),
  email: text('email').notNull(),
  name: text('name').notNull(),
  familySlug: text('family_slug').notNull().unique(),
  familyPasswordHash: text('family_password_hash'),
  familyPasswordVersion: integer('family_password_version').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  lastLogIn: timestamp('last_log_in', { withTimezone: true }),
});

export const kids = pgTable(
  'kids',
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    weeklyAllowanceCents: integer('weekly_allowance_cents').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('kids_user_id_idx').on(table.userId)],
);

export const transactions = pgTable(
  'transactions',
  {
    id: serial().primaryKey(),
    kidId: uuid('kid_id')
      .notNull()
      .references(() => kids.id, { onDelete: 'cascade' }),
    amountCents: integer('amount_cents').notNull(),
    memo: text('memo'),
    fromAllowance: boolean('from_allowance').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('transactions_kid_id_idx').on(table.kidId),
    index('transactions_allowance_check_idx').on(
      table.kidId,
      table.fromAllowance,
      table.createdAt,
    ),
  ],
);

export type User = typeof users.$inferSelect;
export type Kid = typeof kids.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
