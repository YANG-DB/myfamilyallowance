export type User = {
  id: string; email: string; name: string; familySlug: string; createdAt: Date;
};
export type ParentCredential = {id: string; userId: string; email: string; passwordHash: string | null; passwordVersion: number};
export type Kid = {
  id: string; userId: string; name: string; monthlyAllowanceCents: number;
  monthlySpendingLimitCents: number | null; createdAt: Date; updatedAt: Date;
  avatarId?: string | null; email?: string | null;
  loginName: string; passwordHash: string | null; passwordVersion: number;
};
export type CurrencyCode = 'CAD' | 'ILS';
export type Transaction = {
  id: string | number; kidId: string; amountCents: number; memo: string | null;
  fromAllowance: boolean; createdAt: Date; currency?: CurrencyCode; category?: string | null;
  parentPaid?: boolean;
};
export type PlannedItem = {
  id: string | number; kidId: string; url: string; description: string; amountCents: number;
  currency: CurrencyCode; thumbnailUrl: string | null; archived: boolean; createdAt: Date;
};
