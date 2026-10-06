// Protocol and persistence tests. Run: node --experimental-vm-modules tests/instagram.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {SourceTextModule,SyntheticModule,createContext} from 'node:vm';
import {webcrypto,randomBytes} from 'node:crypto';
import ts from 'typescript';
const sql = new DatabaseSync(':memory:');
sql.exec('CREATE TABLE site_settings (key TEXT PRIMARY KEY,value_json TEXT,updated_at TEXT)');
const db = {prepare(query) {return {bind(...args) {return {
  async first() {return sql.prepare(query).get(...args) || null;},
  async run() {return {meta:{changes:Number(sql.prepare(query).run(...args).changes)}};}
};}};}};
let calls = [], fail = false, username = 'juliesufi', blocked, unblock;
const mockFetch = async (url, options = {}) => {
  const u = new URL(url); calls.push(u.pathname);
  if (u.pathname === '/oauth/access_token') return Response.json({access_token:'short-test-token'});
  if (u.pathname === '/access_token') return Response.json({access_token:'private-test-token',expires_in:5184000});
  if (u.pathname === '/refresh_access_token') return Response.json({access_token:'renewed-private-test-token',expires_in:5184000});
  if (u.pathname.endsWith('/me')) return Response.json({user_id:'12345',username});
  if (u.pathname.endsWith('/media')) {
    assert.match(options.headers.Authorization, /^Bearer /);
    if (blocked) {blocked(); await new Promise(resolve => {unblock = resolve;});}
    if (fail) return Response.json({error:{code:190,message:'private-test-token must never leak'}},{status:400});
    return Response.json({data:[
      {id:'r1',media_type:'VIDEO',media_product_type:'REELS',media_url:'https://cdn.example/reel.mp4',thumbnail_url:'https://cdn.example/reel.jpg',permalink:'https://www.instagram.com/reel/r1/',caption:'Our reel'},
      {id:'photo',media_type:'IMAGE',media_product_type:'FEED',media_url:'https://cdn.example/photo.jpg'},
      {id:'bad',media_type:'VIDEO',media_product_type:'REELS',media_url:'javascript:alert(1)',permalink:'https://evil.example/'},
    ]});
  }
  throw new Error('Unexpected endpoint');
};
const context = createContext({crypto:webcrypto, URL, URLSearchParams, TextEncoder,TextDecoder,Uint8Array,Date,AbortSignal,Response,Request,fetch:mockFetch,atob,btoa,console});
function synthetic(exports) {return new SyntheticModule(Object.keys(exports),function(){for(const [k,v] of Object.entries(exports)) this.setExport(k,v);},{context});}
const dependencies = {
  'cloudflare:workers':synthetic({env:{INSTAGRAM_ENCRYPTION_KEY:randomBytes(32).toString('base64')}}),
  './site-data':synthetic({getD1:()=>db}),
  '@/lib/admin-auth':synthetic({isAdminRequest:async r=>r.headers.get('cookie')?.includes('admin=yes')}),
};
async function load(path) {
  const source = ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  const module = new SourceTextModule(source,{context});
  await module.link(id => {assert.ok(dependencies[id],id); return dependencies[id];});
  await module.evaluate(); return module;
}
const module = await load('lib/instagram.ts'), ig = module.namespace;
dependencies['@/lib/instagram'] = module;
assert.equal((await ig.instagramStatus()).configured,false);
await assert.rejects(ig.beginInstagram());
await ig.configureInstagram('123456789','app-secret-test-123456789');
assert.equal((await ig.instagramStatus()).configured,true);
const session = await ig.beginInstagram();
assert.equal(new URL(session.url).searchParams.get('scope'),'instagram_business_basic');
await assert.rejects(ig.finishInstagram('code','invalid-state'));
await ig.finishInstagram('code',session.state);
await assert.rejects(ig.finishInstagram('code',session.state));
let status = await ig.instagramStatus();
assert.equal(status.connected,true); assert.equal(status.count,1);
const raw = sql.prepare('SELECT value_json FROM site_settings WHERE key=?').get('instagram_connection_v1').value_json;
assert.ok(!raw.includes('private-test-token')); assert.ok(!raw.includes('app-secret-test'));
assert.ok(!JSON.stringify(status).includes('token')); assert.ok(!JSON.stringify(await ig.instagramFeed()).includes('token'));
const count = calls.length; await ig.instagramFeed(); assert.equal(calls.length,count,'Fresh cache makes no upstream calls');
function age(extra={}) {
 const row = sql.prepare('SELECT value_json FROM site_settings WHERE key=?').get('instagram_connection_v1');
 const value = {...JSON.parse(row.value_json),syncedAt:Date.now()-3600000,nextSync:0,...extra};
 sql.prepare('UPDATE site_settings SET value_json=? WHERE key=?').run(JSON.stringify(value),'instagram_connection_v1');
}
age({refreshedAt:Date.now()-8*86400000}); await ig.instagramFeed(); assert.ok(calls.includes('/refresh_access_token'));
age(); fail=true; const failed = await ig.instagramFeed(); assert.equal(failed.reels.length,0); assert.equal(failed.connected,false);
assert.match((await ig.instagramStatus()).issue,/reconnect/); fail=false;
const again = await ig.beginInstagram(); username='wrong-account'; await assert.rejects(ig.finishInstagram('code',again.state),/selected account/); username='juliesufi';
const again2=await ig.beginInstagram(); await ig.finishInstagram('code',again2.state);
// A stale in-flight sync must not resurrect a disconnected account.
age(); let reached; const reachedPromise = new Promise(r=>reached=r); blocked=reached;
const pending = ig.instagramFeed(); await reachedPromise; await ig.disconnectInstagram(); unblock(); await pending; blocked=null;
assert.equal((await ig.instagramStatus()).connected,false);
const admin = (await load('app/api/admin/instagram/route.ts')).namespace;
const endpoint='https://julie-sufi-bridal.batmams23.chatgpt.site/api/admin/instagram';
assert.equal((await admin.GET(new Request(endpoint))).status,401);
assert.equal((await admin.POST(new Request(endpoint,{method:'POST',headers:{cookie:'admin=yes',origin:'https://attacker.example'},body:'{"action":"connect"}'}))).status,403);
const callback = (await load('app/api/admin/instagram/callback/route.ts')).namespace;
const badCallback = await callback.GET(new Request(endpoint+'/callback?code=x&state=wrong',{headers:{cookie:'admin=yes; julie_instagram_state=different'}}));
assert.match(badCallback.headers.get('location'),/instagram=failed$/);
console.log('PASS: OAuth one-use state, wrong-account rejection, encrypted credentials, reel filtering, cache, refresh, revocation, disconnect race, admin access and CSRF.');
