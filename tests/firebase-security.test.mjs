import test from 'node:test';
import assert from 'node:assert/strict';
import { astroRequest } from '../firebase/request.mjs';
import { hashPassword, verifyPassword } from '../src/lib/passwords.ts';

test('Passwords use unique salted hashes; exact reusable passwords verify', async () => {
  const password='A reusable family passphrase';
  const one=await hashPassword(password),two=await hashPassword(password);
  assert.notEqual(one,two);assert.ok(!one.includes(password));
  assert.ok(await verifyPassword(password,one));assert.ok(await verifyPassword(password,one));
  assert.equal(await verifyPassword('Wrong family passphrase',one),false);
  assert.equal(await verifyPassword(password.toUpperCase(),one),false);
  assert.equal(await verifyPassword(password,null),false);
  await assert.rejects(hashPassword('short'));
});

test('Firebase request bridge replays bodies and pins the origin', async () => {
  const req=astroRequest({method:'POST',url:'/api/test',headers:{host:'attacker.example','x-forwarded-host':'attacker.example'},rawBody:Buffer.from('hello'),socket:{remoteAddress:'127.0.0.1'}},'https://safe.example');
  assert.equal(req.headers.host,'safe.example');assert.equal(req.headers['x-forwarded-host'],undefined);assert.equal(req.socket.encrypted,true);
  let body='';for await(const bytes of req) body+=bytes.toString();assert.equal(body,'hello');
});

test('Reusable family passwords, scoped sessions, resets, and private Firestore', {skip:!process.env.FIRESTORE_EMULATOR_HOST}, async () => {
  process.env.GCLOUD_PROJECT='demo-family-allowance';
  process.env.OWNER_EMAIL='liordana@gmail.com';process.env.INITIAL_SETUP_TOKEN='test-only-random-bootstrap-token';
  process.env.SESSION_SECRET='test-only-session-secret-at-least-32-characters';process.env.SITE_URL='http://127.0.0.1:8787';
  const {getApps,initializeApp}=await import('firebase-admin/app');if(!getApps().length) initializeApp({projectId:process.env.GCLOUD_PROJECT});
  const {getFirestore}=await import('firebase-admin/firestore');const db=getFirestore();
  const {handler}=await import('../dist/server/entry.mjs');const {createServer}=await import('node:http');
  const base=process.env.SITE_URL;
  const server=createServer(async(req,res)=>{const chunks=[];for await(const chunk of req) chunks.push(chunk);req.rawBody=Buffer.concat(chunks);await handler(astroRequest(req,base),res,()=>{res.statusCode=404;res.end();});});
  await new Promise(resolve=>server.listen(8787,'127.0.0.1',resolve));
  const cookieOf=response=>response.headers.get('set-cookie')?.split(';')[0];
  async function request(path,{cookie='',data,origin=base,address}={}) {
    return fetch(base+path,{redirect:'manual',method:data?'POST':'GET',headers:{...(cookie?{Cookie:cookie}:{}),...(data?{'Content-Type':'application/x-www-form-urlencoded'}:{}),Origin:origin,...(address?{'x-forwarded-for':address}:{})},body:data?new URLSearchParams(data):undefined});
  }
  const ownerPassword='Owner reusable password 2026';
  const setup={email:'liordana@gmail.com',password:ownerPassword,confirmPassword:ownerPassword,setupToken:process.env.INITIAL_SETUP_TOKEN};
  try {
    const signInPage=await request('/kid-login');
    assert.equal(signInPage.headers.get('referrer-policy'),'same-origin');
    assert.ok((await signInPage.text()).includes('name="referrer" content="same-origin"'));
    assert.equal((await request('/api/auth/kid',{data:{username:'sam-demo',password:'sam-demo-2026'},origin:'null'})).status,403);
    assert.equal((await request('/admin')).status,302);
    assert.equal((await request('/admin',{cookie:'__session=demo-parent'})).status,302);
    assert.equal((await request('/api/auth/setup',{data:{...setup,setupToken:'wrong'}})).status,303);
    assert.equal((await db.collection('parentCredentials').get()).size,0);
    assert.equal((await request('/api/auth/setup',{data:setup,origin:'https://attacker.example'})).status,403);
    const first=await request('/api/auth/setup',{data:setup});assert.equal(first.status,303);const initialCookie=cookieOf(first);
    const replay=await request('/api/auth/setup',{data:setup});assert.equal(replay.headers.get('set-cookie'),null);
    const badLogin=await request('/api/auth/session',{data:{email:'liordana@gmail.com',password:'wrong'}});assert.equal(badLogin.headers.get('set-cookie'),null);
    const login=await request('/api/auth/session',{data:{email:'liordana@gmail.com',password:ownerPassword}});const parentCookie=cookieOf(login);assert.ok(parentCookie.startsWith('__session=parent:'));
    const again=await request('/api/auth/session',{data:{email:'liordana@gmail.com',password:ownerPassword}});assert.ok(cookieOf(again));
    const family=(await db.collection('parents').get()).docs[0].data().familySlug;
    for(const name of ['Alex','Sam']) assert.equal((await request('/api/admin/kids',{cookie:parentCookie,data:{name,monthlyAllowance:'10',monthlySpendingLimit:'20'}})).status,302);
    const children=(await db.collection('kids').get()).docs;const kid=children[0],sibling=children[1];
    const passwordApi=`/api/admin/kids/${kid.id}/password`,purchaseApi=`/api/family/${family}/kid/${kid.id}`,kidPage=`/f/${family}/kid/${kid.id}`;
    const kidPassword='My reusable kid password';
    assert.equal((await request(passwordApi,{cookie:parentCookie,data:{action:'save',password:'short',confirmPassword:'short'}})).status,303);
    assert.equal((await db.collection('kids').doc(kid.id).get()).data().passwordHash,null);
    await request(passwordApi,{cookie:parentCookie,data:{action:'save',password:kidPassword,confirmPassword:kidPassword}});
    const kidLoginData={username:kid.data().loginName,password:kidPassword};
    const kidLogin=await request('/api/auth/kid',{data:kidLoginData});const kidCookie=cookieOf(kidLogin);assert.ok(kidCookie?.startsWith('__session=kid:'));
    assert.ok(cookieOf(await request('/api/auth/kid',{data:kidLoginData})));
    assert.equal((await request(kidPage,{cookie:kidCookie})).status,200);
    const avatarApi=purchaseApi+'/avatar';
    assert.equal((await request(avatarApi,{cookie:kidCookie,data:{avatarId:'panda'}})).status,303);
    assert.equal((await db.collection('kids').doc(kid.id).get()).data().avatarId,'panda');
    assert.ok((await (await request(kidPage,{cookie:kidCookie})).text()).includes('aria-label="Chill Panda"'));
    await request(avatarApi,{cookie:kidCookie,data:{avatarId:'not-a-real-character'}});
    assert.equal((await db.collection('kids').doc(kid.id).get()).data().avatarId,'panda');
    assert.equal((await request(`/api/family/${family}/kid/${sibling.id}/avatar`,{cookie:kidCookie,data:{avatarId:'fox'}})).status,403);
    assert.equal((await request(avatarApi,{data:{avatarId:'fox'}})).status,403);

    assert.equal((await request(`/f/${family}/kid/${sibling.id}`,{cookie:kidCookie})).headers.get('location'),'/kid-login');
    assert.equal((await request('/admin',{cookie:kidCookie})).status,302);
    assert.equal((await request(passwordApi,{cookie:kidCookie,data:{action:'revoke'}})).status,403);
    assert.equal((await request('/api/admin/parents',{cookie:kidCookie,data:{email:'intruder@example.com',password:kidPassword,confirmPassword:kidPassword}})).status,403);
    assert.equal((await request(purchaseApi,{data:{amount:'1',description:'Anonymous'}})).status,403);
    assert.equal((await request(`/api/family/${family}/kid/${sibling.id}`,{cookie:kidCookie,data:{amount:'1',description:'Sibling'}})).status,403);
    assert.equal((await request(purchaseApi,{cookie:kidCookie,data:{amount:'2.50',description:'Book'}})).status,303);
    const warning=await request(purchaseApi,{cookie:kidCookie,data:{amount:'30',description:'Over budget'}});assert.match(warning.headers.get('location'),/purchaseAmount/);
    assert.equal((await db.collection('kids').doc(kid.id).collection('transactions').get()).size,1);
    await request(purchaseApi,{cookie:kidCookie,data:{amount:'30',description:'Over budget',confirmOverLimit:'yes'}});
    assert.equal((await db.collection('kids').doc(kid.id).collection('transactions').get()).size,2);
    const stored=(await db.collection('kids').doc(kid.id).get()).data();assert.match(stored.passwordHash,/^scrypt\$131072\$8\$1\$/);assert.ok(!JSON.stringify(stored).includes(kidPassword));
    const direct=`http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/demo-family-allowance/databases/(default)/documents/kids/${kid.id}`;assert.equal((await fetch(direct)).status,403);
    const newKidPassword='Replacement kid password';
    await request(passwordApi,{cookie:parentCookie,data:{action:'save',password:newKidPassword,confirmPassword:newKidPassword}});
    assert.equal((await request(kidPage,{cookie:kidCookie})).headers.get('location'),'/kid-login');
    assert.equal((await request('/api/auth/kid',{data:kidLoginData})).headers.get('set-cookie'),null);
    const freshKid=cookieOf(await request('/api/auth/kid',{data:{...kidLoginData,password:newKidPassword}}));assert.ok(freshKid);
    await request(passwordApi,{cookie:parentCookie,data:{action:'revoke'}});assert.equal((await request(purchaseApi,{cookie:freshKid,data:{amount:'1',description:'Disabled'}})).status,403);
    const secondPassword='Another parent password';
    await request('/api/admin/parents',{cookie:parentCookie,data:{email:'second@example.com',password:secondPassword,confirmPassword:secondPassword}});
    const secondCookie=cookieOf(await request('/api/auth/session',{data:{email:'second@example.com',password:secondPassword}}));assert.ok(secondCookie);
    assert.ok((await (await request('/admin',{cookie:secondCookie})).text()).includes(kid.data().name));
    const newOwnerPassword='Updated owner password 2026';
    await request('/api/admin/password',{cookie:parentCookie,data:{currentPassword:ownerPassword,password:newOwnerPassword,confirmPassword:newOwnerPassword}});
    assert.equal((await request('/admin',{cookie:initialCookie})).status,302);assert.equal((await request('/admin',{cookie:parentCookie})).status,302);
    assert.equal((await request('/admin',{cookie:secondCookie})).status,200);
    assert.equal((await request('/api/auth/session',{data:{email:'liordana@gmail.com',password:ownerPassword}})).headers.get('set-cookie'),null);
    assert.ok(cookieOf(await request('/api/auth/session',{data:{email:'liordana@gmail.com',password:newOwnerPassword}})));
    const {monthlyAllowance}=await import('../.firebase-app/index.mjs');const schedule={scheduleTime:'2026-10-25T14:00:00.000Z'};
    await monthlyAllowance.run(schedule);await monthlyAllowance.run(schedule);
    assert.equal((await db.collection('kids').doc(kid.id).collection('transactions').where('fromAllowance','==',true).get()).size,1);
    for(let attempt=0;attempt<21;attempt++) {
      const response=await request('/api/auth/kid',{data:{username:'does-not-exist',password:'bad'},address:'192.0.2.17'});
      assert.equal(response.status,attempt<20?303:429);
    }
    assert.ok(!(await (await request('/')).text()).includes('Local demo'));
    assert.equal((await request('/')).headers.get('cache-control'),'private, no-store');
  } finally {await new Promise(resolve=>server.close(resolve));}
});
