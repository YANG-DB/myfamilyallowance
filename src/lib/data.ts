import { demoMode, demo, demoBalance } from './demo';
import { firestore } from './firebase-admin';
import type { Kid, User, Transaction, PlannedItem, CurrencyCode } from './models';
import { toCadCents } from './money';
import { encryptEmail } from './crypto';

function date(value: any): Date { return value?.toDate ? value.toDate() : new Date(value); }
function kidRow(id: string, data: any): Kid { return {...data, id, createdAt: date(data.createdAt), updatedAt: date(data.updatedAt)}; }
function userRow(id: string, data: any): User { return {...data, id, createdAt: date(data.createdAt)}; }
function txRow(id: string, kidId: string, data: any): Transaction { return {...data, id, kidId, createdAt: date(data.createdAt)}; }
function plannedRow(id: string, kidId: string, data: any): PlannedItem { return {...data, id, kidId, createdAt: date(data.createdAt)}; }
export async function getUser(id: string): Promise<User | null> {
  if (demoMode) return id === demo.user.id ? demo.user : null;
  const doc = await firestore().collection('parents').doc(id).get();
  return doc.exists ? userRow(doc.id, doc.data()) : null;
}
export async function getKid(id: string): Promise<Kid | null> {
  if (demoMode) return demo.kids.find(k => k.id === id) ?? null;
  const row = await firestore().collection('kids').doc(id).get();
  return row.exists ? kidRow(row.id, row.data()) : null;
}
export async function getOwnedKid(userId: string, kidId: string): Promise<Kid | null> {
  const kid = await getKid(kidId);
  return kid?.userId === userId ? kid : null;
}
async function getKids(userId: string): Promise<Kid[]> {
  return demoMode ? demo.kids.filter(k => k.userId === userId) :
    (await firestore().collection('kids').where('userId', '==', userId).get()).docs.map(d => kidRow(d.id, d.data()));
}
export async function getKidsWithBalances(userId: string) {
  const kids = await getKids(userId);
  return Promise.all(kids.sort((a,b) => a.name.localeCompare(b.name)).map(async k => ({...k, balanceCents: await getKidBalance(k.id)})));
}
export async function getKidByName(userId: string, name: string): Promise<Kid | null> {
  const kids = await getKids(userId);
  return kids.find(k => k.name.toLowerCase() === name.toLowerCase()) ?? null;
}
async function getAllKids(): Promise<Kid[]> {
  return demoMode ? demo.kids :
    (await firestore().collection('kids').get()).docs.map(d => kidRow(d.id, d.data()));
}
// Used by short vanity URLs (e.g. /noni) that have no family slug to scope the lookup.
export async function findKidByNameAcrossFamilies(name: string): Promise<{kid: Kid; owner: User} | null> {
  const lower = name.toLowerCase();
  const kids = await getAllKids();
  const matches = kids.filter(k => k.name.toLowerCase() === lower || k.loginName.toLowerCase() === lower);
  if (matches.length !== 1) return null;
  const owner = await getUser(matches[0].userId);
  return owner ? {kid: matches[0], owner} : null;
}
// Used by the kid sign-in chooser, which has no family context yet either.
export async function listSignInNames(): Promise<{name: string; loginName: string}[]> {
  const kids = await getAllKids();
  return kids.filter(k => k.passwordHash).map(k => ({name: k.name, loginName: k.loginName})).sort((a,b) => a.name.localeCompare(b.name));
}
export async function allTransactions(kidId: string): Promise<Transaction[]> {
  if (demoMode) return demo.transactions.filter(tx => tx.kidId === kidId);
  return (await firestore().collection('kids').doc(kidId).collection('transactions').get()).docs.map(d => txRow(d.id, kidId, d.data()));
}
export async function getKidBalance(kidId: string) {
  if (demoMode) return demoBalance(kidId);
  // A manually marked parent-paid transaction (checkbox override) is money the parent
  // covered directly, so it never touches the kid's balance. Category-based auto-exclusion
  // (see isParentPaidCategory) only affects the spending-limit total, not the balance.
  return (await allTransactions(kidId)).reduce((n, tx) => tx.parentPaid ? n : n + toCadCents(tx.amountCents, tx.currency), 0);
}
export type TransactionSort = 'date' | 'amount' | 'memo' | 'category';
export type TransactionFilter = {memo?: string; category?: string; dateFrom?: string; dateTo?: string; amountMin?: number; amountMax?: number};
export async function listTransactions(kidId: string, page: number, pageSize = 20, options: {sort?: TransactionSort; dir?: 'asc' | 'desc'; filter?: TransactionFilter} = {}) {
  let rows = await allTransactions(kidId);
  const f = options.filter;
  if (f?.memo) rows = rows.filter(tx => (tx.memo ?? '').toLowerCase().includes(f.memo!.toLowerCase()));
  if (f?.category) rows = rows.filter(tx => (tx.category ?? '').toLowerCase().includes(f.category!.toLowerCase()));
  if (f?.dateFrom) rows = rows.filter(tx => tx.createdAt >= new Date(`${f.dateFrom}T00:00:00`));
  if (f?.dateTo) rows = rows.filter(tx => tx.createdAt <= new Date(`${f.dateTo}T23:59:59`));
  if (f?.amountMin != null) rows = rows.filter(tx => tx.amountCents >= f.amountMin!);
  if (f?.amountMax != null) rows = rows.filter(tx => tx.amountCents <= f.amountMax!);

  const sort = options.sort ?? 'date';
  const mul = options.dir === 'asc' ? 1 : -1;
  rows = rows.sort((a, b) => {
    const cmp = sort === 'amount' ? a.amountCents - b.amountCents
      : sort === 'memo' ? (a.memo ?? '').localeCompare(b.memo ?? '')
      : sort === 'category' ? (a.category ?? '').localeCompare(b.category ?? '')
      : a.createdAt.getTime() - b.createdAt.getTime();
    return (cmp || a.createdAt.getTime() - b.createdAt.getTime()) * mul;
  });
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  return {items: rows.slice((page-1)*pageSize, page*pageSize), hasMore: rows.length > page*pageSize, page, pageSize, total: rows.length, totalPages};
}
export async function createKid(userId: string, name: string, monthlyAllowanceCents: number, monthlySpendingLimitCents: number | null) {
  const kid: Kid = {id: crypto.randomUUID(), userId, name, monthlyAllowanceCents, monthlySpendingLimitCents, createdAt: new Date(), updatedAt: new Date(), loginName: `${name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0,16) || 'kid'}-${crypto.randomUUID().slice(0,8)}`, passwordHash: null, passwordVersion: 0};
  if (demoMode) demo.kids.push(kid);
  else await firestore().collection('kids').doc(kid.id).create(kid);
  return kid;
}
export async function updateKid(kid: Kid, changes: Pick<Kid, 'name' | 'monthlyAllowanceCents' | 'monthlySpendingLimitCents'>) {
  if (demoMode) Object.assign(kid, changes, {updatedAt: new Date()});
  else await firestore().collection('kids').doc(kid.id).update({...changes, updatedAt: new Date()});
}
export async function deleteKid(kid: Kid) {
  if (demoMode) {
    demo.kids = demo.kids.filter(k => k.id !== kid.id);
    demo.transactions = demo.transactions.filter(tx => tx.kidId !== kid.id);
  } else {
    // Remove access first; no new child sessions can be created during cleanup.
    await firestore().collection('kids').doc(kid.id).update({passwordHash: null, passwordVersion: kid.passwordVersion + 1});
    await firestore().recursiveDelete(firestore().collection('kids').doc(kid.id));
  }
}
export async function addTransaction(input: Omit<Transaction, 'id' | 'createdAt'> & {createdAt?: Date}) {
  const entry = {...input, createdAt: input.createdAt ?? new Date()};
  if (demoMode) demo.transactions.push({...entry, id: demo.nextId++});
  else await firestore().collection('kids').doc(input.kidId).collection('transactions').add(entry);
}
export async function getTransaction(kidId: string, id: string): Promise<Transaction | null> {
  if (demoMode) return demo.transactions.find(tx => tx.kidId === kidId && String(tx.id) === id) ?? null;
  const row = await firestore().collection('kids').doc(kidId).collection('transactions').doc(id).get();
  return row.exists ? txRow(row.id, kidId, row.data()) : null;
}
export async function updateTransaction(kidId: string, id: string, changes: {amountCents: number; memo: string | null; category: string | null; parentPaid: boolean; currency: CurrencyCode; createdAt: Date}) {
  if (demoMode) {
    const tx = demo.transactions.find(t => t.kidId === kidId && String(t.id) === id);
    if (tx) Object.assign(tx, changes);
  } else {
    await firestore().collection('kids').doc(kidId).collection('transactions').doc(id).update(changes);
  }
}
export async function deleteTransaction(kidId: string, id: string) {
  if (demoMode) {
    demo.transactions = demo.transactions.filter(t => !(t.kidId === kidId && String(t.id) === id));
  } else {
    await firestore().collection('kids').doc(kidId).collection('transactions').doc(id).delete();
  }
}
export async function listPlannedItems(kidId: string): Promise<PlannedItem[]> {
  const rows = demoMode
    ? demo.plannedItems.filter(item => item.kidId === kidId)
    : (await firestore().collection('kids').doc(kidId).collection('plannedItems').get()).docs.map(d => plannedRow(d.id, kidId, d.data()));
  return rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
export async function addPlannedItem(input: Omit<PlannedItem, 'id' | 'createdAt' | 'archived'>) {
  const entry = {...input, archived: false, createdAt: new Date()};
  if (demoMode) demo.plannedItems.push({...entry, id: demo.nextPlannedId++});
  else await firestore().collection('kids').doc(input.kidId).collection('plannedItems').add(entry);
}
export async function getPlannedItem(kidId: string, id: string): Promise<PlannedItem | null> {
  if (demoMode) return demo.plannedItems.find(item => item.kidId === kidId && String(item.id) === id) ?? null;
  const row = await firestore().collection('kids').doc(kidId).collection('plannedItems').doc(id).get();
  return row.exists ? plannedRow(row.id, kidId, row.data()) : null;
}
export async function archivePlannedItem(kidId: string, id: string) {
  if (demoMode) {
    const item = demo.plannedItems.find(i => i.kidId === kidId && String(i.id) === id);
    if (item) item.archived = true;
  } else {
    await firestore().collection('kids').doc(kidId).collection('plannedItems').doc(id).update({archived: true});
  }
}
export async function getFamilyBySlug(slug: string) {
  if (demoMode) return slug === demo.user.familySlug ? demo.user : null;
  const doc = await firestore().collection('familySlugs').doc(slug).get();
  return doc.exists ? getUser(doc.data()!.userId) : null;
}

export async function setKidAvatar(kid: Kid, avatarId: string) {
  if (demoMode) Object.assign(kid,{avatarId,updatedAt:new Date()});
  else await firestore().collection('kids').doc(kid.id).update({avatarId,updatedAt:new Date()});
}
export async function setKidEmail(kid: Kid, email: string | null) {
  const stored = email ? encryptEmail(email) : null;
  if (demoMode) Object.assign(kid,{email: stored,updatedAt:new Date()});
  else await firestore().collection('kids').doc(kid.id).update({email: stored,updatedAt:new Date()});
}
