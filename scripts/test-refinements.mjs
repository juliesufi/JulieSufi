import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { z } from "zod";
// Isolated protocol/model tests: no production data, network, or credentials.
const rows=new Map(),uploads=new Map(),objects=new Map();
const db={prepare(sql){let args=[];return {bind(...v){args=v;return this;},async first(){return rows.has(args[0])?{value_json:rows.get(args[0])}:null;},async run(){if(sql.startsWith("INSERT"))rows.set(args[0],args[1]);else if(sql.startsWith("UPDATE"))rows.set(args[1],args[0]);else if(sql.startsWith("DELETE"))rows.delete(args[0]);return {meta:{changes:1}};}};}};
const bucket={async createMultipartUpload(key){const uploadId=crypto.randomUUID();uploads.set(uploadId,{key,parts:new Map()});return this.resumeMultipartUpload(key,uploadId);},resumeMultipartUpload(key,id){return {uploadId:id,async uploadPart(part,bytes){uploads.get(id).parts.set(part,bytes.byteLength);return {partNumber:part,etag:"part-"+part};},async complete(parts){const up=uploads.get(id);const size=parts.reduce((total,p)=>total+up.parts.get(p.partNumber),0);const obj={key,size};objects.set(key,obj);return obj;},async abort(){uploads.delete(id);}};},async head(key){return objects.get(key)||null;},async delete(key){objects.delete(key);}};
const context=vm.createContext({console,Request,Response,Headers,URL,crypto,Date,Uint8Array,structuredClone,TextEncoder,TextDecoder,setTimeout,clearTimeout});
function mock(exports){return new vm.SyntheticModule(Object.keys(exports),function(){for(const [k,v] of Object.entries(exports))this.setExport(k,v);},{context});}
async function module(path,imports){const code=ts.transpileModule(fs.readFileSync(path,"utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;const m=new vm.SourceTextModule(code,{context});await m.link(name=>{if(!imports[name])throw new Error("Unexpected import "+name);return mock(imports[name]);});await m.evaluate();return m.namespace;}
const route=await module("app/api/admin/uploads/route.ts",{"cloudflare:workers":{env:{BUCKET:bucket}},"@/lib/admin-auth":{isAdminRequest:async r=>r.headers.get("cookie")==="test"},"@/lib/site-data":{getD1:()=>db}});
async function call(method,query="",body,expected=200,auth=true){
 const req=new Request("https://test.example/api/admin/uploads"+query,{method,headers:{...(auth?{cookie:"test"}:{}),...(body instanceof Uint8Array?{}:{"Content-Type":"application/json"})},body:body instanceof Uint8Array?body:body===undefined?undefined:JSON.stringify(body)});
 const r=await route[method](req);const data=await r.json();assert.equal(r.status,expected,JSON.stringify(data));return data;
}
await call("POST","",{name:"x.png",type:"image/png",size:1},401,false);
await call("POST","",{name:"x.svg",type:"image/svg+xml",size:1},400);
await call("POST","",{name:"x.jpg",type:"image/jpeg",size:100*1024*1024+1},413);
await call("POST","",{name:"x.mp4",type:"video/mp4",size:500*1024*1024+1},413);
for(const [name,type,size] of [["large.jpg","image/jpeg",100*1024*1024],["large.mp4","video/mp4",500*1024*1024]]){
 const s=await call("POST","",{name,type,size});
 await call("PATCH","?id="+s.id,undefined,400);
 await call("PUT","?id="+s.id+"&part=1",new Uint8Array(1),400);
 for(let offset=0,part=1;offset<size;offset+=s.chunkSize,part++)await call("PUT","?id="+s.id+"&part="+part,new Uint8Array(Math.min(s.chunkSize,size-offset)));
 const completed=await call("PATCH","?id="+s.id);assert.equal(objects.get(completed.url.replace("/api/media/","")).size,size);
 assert.deepEqual(await call("PATCH","?id="+s.id),completed,"Finalisation is safe to retry");
 console.log("PASS: chunked "+(size/1024/1024)+" MB protocol and size enforcement");
}
const abort=await call("POST","",{name:"abort.mp4",type:"video/mp4",size:10});await call("DELETE","?id="+abort.id);await call("PATCH","?id="+abort.id,undefined,404);
const model=await module("lib/studio-model.ts",{zod:{z}});
const media=[{id:"visible",url:"https://example.com/photo.jpg",type:"image",alt:"",seconds:8.5,shown:true},{id:"hidden",url:"https://example.com/hidden.jpg",type:"image",alt:"",shown:false}];
const data={version:2,settings:{brandName:"Julie Sufi",announcement:"",contactEmail:"test@example.com",contactPhone:"0400000000",studioLocation:"Melbourne",footerNote:"",headerHeight:30,footerHeight:65},home:[{id:"panel",label:"Panel",type:"hero",shown:true,title:"",body:"",media,linkLabel:"",link:"",reelUrl:"",height:80}],pages:[],collections:[{id:"c",slug:"collection",name:"Collection",description:"",published:true,heroShown:false,heroHeight:20,hero:media,cover:media,products:[{id:"p",slug:"gown",name:"Gown",description:"",price:100,showPrice:false,published:true,media}]}]};
const parsed=model.studioSchema.parse(data),pub=model.publicData(parsed);
assert.equal(parsed.home[0].media.length,2,"Hidden media is retained in the editor");
assert.equal(pub.home[0].media.length,1);assert.equal(pub.home[0].media[0].seconds,8.5);assert.equal(pub.collections[0].heroShown,false);assert.equal(pub.collections[0].products[0].media.length,1);assert.equal(pub.collections[0].products[0].price,null);
assert.equal(pub.settings.headerHeight,30);assert.equal(pub.settings.footerHeight,65);
const enquiry=await module("app/api/enquiries/route.ts",{"@/lib/request-limit":{requestAllowed:async()=>true},"@/lib/admin-auth":{isAdminRequest:async()=>true},"@/lib/site-data":{getD1:()=>db},zod:{z}});
const body={name:"Test",email:"test@example.com",phone:"",message:"Hello",kind:"General",productUrl:"",website:""};
const missing=await enquiry.POST(new Request("https://test.example/api/enquiries",{method:"POST",body:JSON.stringify(body)}));assert.equal(missing.status,400);
const valid=await enquiry.POST(new Request("https://test.example/api/enquiries",{method:"POST",body:JSON.stringify({...body,phone:"0400000000"})}));assert.equal(valid.status,200);
console.log("PASS: hidden media retained, display timings, height settings, collection hero toggle, mandatory phone, and existing price privacy");
