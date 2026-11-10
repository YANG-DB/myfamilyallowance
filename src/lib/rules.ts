// Mirrors the family's spending policy in data/rules.md: which categories parents cover
// outright, excluded from a kid's monthly spending limit.
export const RULE_CATEGORIES = [
  'Clothing', 'Recreation & Sport', 'Food', 'Entertainment & Connectivity', 'Transportation', 'Toileting & Care',
  'University studies', 'Driving Lessons', 'Other',
] as const;

const PARENT_PAID_CATEGORIES = new Set(['recreation & sport', 'entertainment & connectivity', 'transportation', 'toileting & care']);
export function isParentPaidCategory(category?: string | null): boolean {
  return !!category && PARENT_PAID_CATEGORIES.has(category.trim().toLowerCase());
}
