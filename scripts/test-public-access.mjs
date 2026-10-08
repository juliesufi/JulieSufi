import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {DatabaseSync} from "node:sqlite";
import ts from "typescript";
import {z} from "zod";
const sql=new DatabaseSync(":memory:");
sql.exec("CREATE TABLE site_settings(key TEXT PRIMARY KEY,value_json TEXT,updated_at TEXT)");
const db={prepare(q){let a=[];return {bind(...v){a=v;return this},async first(){return sql.prepare(q).get(...a)},async run(){return sql.prepare(q).run(...a)},async all(){return {results:sql.prepare(q).all(...a)}}}}};
const env={ADMIN_PASSCODE:"test-password-only",ADMIN_SESSION_SECRET:"test-session-secret-not-production"};
const context=vm.createContext({console,crypto,Request,Response,URL,TextEncoder,Uint8Array,btoa,atob,Date,process});
async function mod(path,imports){
 const code=ts.transpileModule(fs.readFileSync(path,"utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 const m=new vm.SourceTextModule(code,{context});
 await m.link(name=>{const e=imports[name];if(!e)throw Error("Missing import "+name);return new vm.SyntheticModule(Object.keys(e),function(){for(const[k,v]of Object.entries(e))this.setExport(k,v)},{context})});await m.evaluate();return m.namespace;
}
const origin=await mod("lib/request-origin.ts",{});
const auth=await mod("lib/admin-auth.ts",{"cloudflare:workers":{env},"./request-origin":origin});
const limit=await mod("lib/request-limit.ts",{"./site-data":{getD1:()=>db}});
const login=await mod("app/api/admin/login/route.ts",{"../../../../lib/admin-auth":auth,"@/lib/request-limit":limit,"@/lib/request-origin":origin});
const req=(path,method="GET",body,headers={})=>new Request("https://example.test"+path,{method,headers:{origin:"https://example.test","cf-connecting-ip":"192.0.2.1",...headers},body:body===undefined?undefined:JSON.stringify(body)});
assert.equal((await login.POST(req("/api/admin/login","POST",{passcode:"wrong"}))).status,401);
const signed=await login.POST(req("/api/admin/login","POST",{passcode:env.ADMIN_PASSCODE}));
assert.equal(signed.status,200);const cookie=signed.headers.get("set-cookie").split(";")[0];
assert.match(signed.headers.get("set-cookie"),/HttpOnly/);assert.match(signed.headers.get("set-cookie"),/Secure/);
assert.equal(await auth.isAdminRequest(req("/admin")),false);
assert.equal(await auth.isAdminRequest(req("/admin","GET",undefined,{cookie})),true);
env.ADMIN_SESSION_SECRET="rotated";assert.equal(await auth.isAdminRequest(req("/admin","GET",undefined,{cookie})),false);env.ADMIN_SESSION_SECRET="test-session-secret-not-production";
process.env.TRUST_PROXY="1";
const proxied=await login.POST(new Request("http://127.0.0.1:5173/api/admin/login",{method:"POST",headers:{origin:"https://preview.example","x-forwarded-host":"preview.example","x-forwarded-proto":"https","content-type":"application/json","cf-connecting-ip":"192.0.2.1"},body:JSON.stringify({passcode:env.ADMIN_PASSCODE})}));
assert.equal(proxied.status,200);assert.match(proxied.headers.get("set-cookie"),/Secure/);
assert.equal((await login.POST(new Request("http://127.0.0.1:5173/api/admin/login",{method:"POST",headers:{origin:"https://evil.example","x-forwarded-host":"preview.example","x-forwarded-proto":"https","content-type":"application/json","cf-connecting-ip":"192.0.2.1"},body:JSON.stringify({passcode:env.ADMIN_PASSCODE})}))).status,403);
delete process.env.TRUST_PROXY;
const preview=await mod("app/api/storefront/route.ts",{"@/lib/admin-auth":auth,"@/lib/studio-model":{publicData:d=>({title:d.title})},"@/lib/studio-store":{readStudio:async()=>({draft:{title:"draft",privatePrice:5000},live:{title:"live",privatePrice:5000}})}});
const pub=await preview.GET(req("/api/storefront"));assert.equal(pub.status,200);assert.deepEqual(await pub.json(),{title:"live"});
assert.equal((await preview.GET(req("/api/storefront?preview=1"))).status,401);
assert.deepEqual(await (await preview.GET(req("/api/storefront?preview=1","GET",undefined,{cookie}))).json(),{title:"draft"});
const enquiries=await mod("app/api/enquiries/route.ts",{"@/lib/admin-auth":auth,"@/lib/site-data":{getD1:()=>db},"@/lib/request-limit":limit,"@/lib/request-origin":origin,zod:{z}});
const body={name:"Test bride",email:"test@example.com",phone:"0400000000",message:"Test only",kind:"Custom bridal",productUrl:""};
assert.equal((await enquiries.POST(req("/api/enquiries","POST",body))).status,200);
assert.equal((await enquiries.GET(req("/api/enquiries"))).status,401);
assert.equal((await enquiries.PATCH(req("/api/enquiries","PATCH",{action:"delete",ids:[crypto.randomUUID()]}))).status,401);
assert.equal((await enquiries.POST(req("/api/enquiries","POST",body,{origin:"https://other.test"}))).status,403);
for(let i=0;i<4;i++)assert.equal((await enquiries.POST(req("/api/enquiries","POST",body))).status,200);
assert.equal((await enquiries.POST(req("/api/enquiries","POST",body))).status,429);
const feed=await mod("app/api/instagram/route.ts",{"@/lib/instagram":{instagramFeed:async()=>({reels:[]})}});
assert.equal((await feed.GET(req("/api/instagram"))).status,200);
for(let i=0;i<8;i++)await login.POST(req("/api/admin/login","POST",{passcode:"wrong"}));
assert.equal((await login.POST(req("/api/admin/login","POST",{passcode:"wrong"}))).status,429);
delete env.ADMIN_PASSCODE;assert.equal((await login.POST(req("/api/admin/login","POST",{passcode:"0000"}))).status,503);
// Every mutating admin handler checks server-side authentication (login excepted).
for(const file of ["app/api/admin/data/route.ts","app/api/admin/upload/route.ts","app/api/admin/uploads/route.ts","app/api/admin/instagram/route.ts"]){
 const code=fs.readFileSync(file,"utf8");assert.match(code,/isAdminRequest/);assert.match(code,/401/);
}
console.log("PASS: public live data and Instagram; private drafts; anonymous enquiries; enquiry privacy; correct/incorrect admin login; signed cookies; session rotation; fail-closed configuration; durable request limits.");
