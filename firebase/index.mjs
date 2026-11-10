import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { astroRequest } from './request.mjs';
const sessionSecret = defineSecret('SESSION_SECRET');
const setupToken = defineSecret('INITIAL_SETUP_TOKEN');
let appHandler;
export const app = onRequest({region:'us-west1', memory:'512MiB', maxInstances:3, concurrency:2, secrets:[sessionSecret,setupToken]}, async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  if (!process.env.SITE_URL || !process.env.OWNER_EMAIL || !process.env.GCLOUD_PROJECT) {
    res.status(503).send('Application configuration is incomplete.'); return;
  }
  if (req.rawBody?.length > 16384) {res.status(413).send('Request too large'); return;}
  appHandler ??= import('./dist/server/entry.mjs').then(module => module.handler);
  const handler = await appHandler;
  await handler(astroRequest(req, process.env.SITE_URL), res, () => {res.status(404).send('Not found');});
});

// Deterministic monthly document IDs make retries and overlapping invocations safe.
export const monthlyAllowance = onSchedule({schedule:'0 7 1 * *', timeZone:'America/Vancouver', region:'us-west1', maxInstances:1}, async event => {
  if (!getApps().length) initializeApp();
  const db = getFirestore();
  const scheduled = new Date(event.scheduleTime);
  const day = new Intl.DateTimeFormat('en-CA', {timeZone:'America/Vancouver', year:'numeric', month:'2-digit', day:'2-digit'}).format(scheduled);
  const kids = await db.collection('kids').get();
  for (const doc of kids.docs) {
    await db.runTransaction(async tx => {
      const credit = doc.ref.collection('transactions').doc(`allowance-${day}`);
      const current = await tx.get(doc.ref); const existing = await tx.get(credit);
      if (!current.exists || existing.exists) return;
      const cents = current.data().monthlyAllowanceCents;
      if (!Number.isSafeInteger(cents) || cents <= 0) return;
      tx.create(credit, {kidId:doc.id, amountCents:cents, memo:'Allowance added!', fromAllowance:true, createdAt:scheduled});
    });
  }
});
