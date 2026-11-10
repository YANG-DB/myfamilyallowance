import { createHash, timingSafeEqual } from 'node:crypto';
import { demoMode, demo } from './demo';
import { firestore } from './firebase-admin';
import { hashPassword } from './passwords';
import { generateFamilySlug } from './slug';
import { encryptEmail } from './crypto';
import type { Kid, ParentCredential, User } from './models';
export function parentId(email: string) { return createHash('sha256').update(email.trim().toLowerCase()).digest('hex'); }
export function validEmail(email: string) { return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
export async function getParentCredential(id: string): Promise<ParentCredential | null> {
  if (demoMode) return demo.parents.find(parent => parent.id === id) ?? null;
  const doc=await firestore().collection('parentCredentials').doc(id).get();
  return doc.exists ? {...doc.data(), id:doc.id} as ParentCredential : null;
}
export async function findKidByLogin(login: string): Promise<Kid | null> {
  if (demoMode) return demo.kids.find(kid => kid.loginName === login) ?? null;
  const docs=await firestore().collection('kids').where('loginName','==',login).limit(1).get();
  if (docs.empty) return null;
  return {...docs.docs[0].data(),id:docs.docs[0].id} as Kid;
}
export async function setKidPassword(kid: Kid, password: string | null) {
  const passwordHash=password === null ? null : await hashPassword(password);
  if (demoMode) {kid.passwordHash=passwordHash;kid.passwordVersion+=1;return;}
  const db=firestore();const ref=db.collection('kids').doc(kid.id);
  await db.runTransaction(async tx => {
    const doc=await tx.get(ref);
    if (!doc.exists || doc.data()!.userId !== kid.userId) throw new Error('Kid not found');
    tx.update(ref,{passwordHash,passwordVersion:(doc.data()!.passwordVersion ?? 0)+1,updatedAt:new Date()});
  });
}
export async function changeParentPassword(credential: ParentCredential, password: string) {
  const passwordHash=await hashPassword(password);
  if (demoMode) {credential.passwordHash=passwordHash;credential.passwordVersion+=1;return true;}
  const db=firestore();const ref=db.collection('parentCredentials').doc(credential.id);
  return db.runTransaction(async tx => {
    const current=await tx.get(ref);
    if (!current.exists || current.data()!.passwordVersion !== credential.passwordVersion) return false;
    tx.update(ref,{passwordHash,passwordVersion:credential.passwordVersion+1});return true;
  });
}
export async function addParent(userId: string, email: string, password: string) {
  const id=parentId(email);const credential: ParentCredential={id,userId,email:encryptEmail(email),passwordHash:await hashPassword(password),passwordVersion:0};
  if (demoMode) {
    if (demo.parents.some(parent => parent.id === id)) return false;
    demo.parents.push(credential);return true;
  }
  try {await firestore().collection('parentCredentials').doc(id).create(credential);return true;}
  catch(error) {if ((error as {code?:number}).code === 6) return false;throw error;}
}
export async function initializeOwner(email: string, password: string, token: string) {
  const owner=(process.env.OWNER_EMAIL || '').trim().toLowerCase();
  const expected=(process.env.INITIAL_SETUP_TOKEN || '').trim();
  const tokenHash=(value:string) => createHash('sha256').update(value).digest();
  console.log('[setup-debug]', JSON.stringify({expectedLen:expected.length, tokenLen:token.trim().length, expectedHash:tokenHash(expected).toString('hex'), tokenHash:tokenHash(token.trim()).toString('hex')}));
  if (demoMode || !expected || email !== owner || !timingSafeEqual(tokenHash(token.trim()),tokenHash(expected))) return null;
  const id=parentId(email);const encrypted=encryptEmail(email);
  const user: User={id,email:encrypted,name:'Parent',familySlug:generateFamilySlug(5),createdAt:new Date()};
  const credential: ParentCredential={id,userId:id,email:encrypted,passwordHash:await hashPassword(password),passwordVersion:0};
  const db=firestore();
  return db.runTransaction(async tx => {
    const parentRef=db.collection('parentCredentials').doc(id);const userRef=db.collection('parents').doc(id);
    const slugRef=db.collection('familySlugs').doc(user.familySlug);
    const [existing,existingUser,slug]=await tx.getAll(parentRef,userRef,slugRef);
    if (existing.exists || existingUser.exists || slug.exists) return null;
    tx.create(parentRef,credential);tx.create(userRef,user);tx.create(slugRef,{userId:id});return credential;
  });
}
