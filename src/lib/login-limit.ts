import { createHash } from 'node:crypto';
import { demoMode } from './demo';
import { firestore } from './firebase-admin';
const attempts = new Map<string, {count: number; until: number}>();
export async function allowLoginAttempt(address: string, identifier: string) {
  const keys = [`ip:${address}`, `account:${identifier.trim().toLowerCase()}`].map(v => createHash('sha256').update(v).digest('hex'));
  const now = Date.now();
  const next = (old?: {count: number; until: number}) => !old || old.until <= now ? {count:1, until:now + 15*60*1000} : {count:old.count+1, until:old.until};
  if (demoMode) {
    const values = keys.map(key => {const value=next(attempts.get(key));attempts.set(key,value);return value;});
    return values.every(value => value.count <= 20);
  }
  const db = firestore();
  return db.runTransaction(async tx => {
    const refs = keys.map(key => db.collection('loginAttempts').doc(key));
    const docs = await tx.getAll(...refs);
    const values = docs.map(doc => next(doc.data() as {count:number;until:number}|undefined));
    refs.forEach((ref,i) => tx.set(ref,values[i]));
    return values.every(value => value.count <= 20);
  });
}
