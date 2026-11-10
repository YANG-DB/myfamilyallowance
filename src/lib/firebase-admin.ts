import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
export function firestore() { return getFirestore(getApps()[0] ?? initializeApp()); }
