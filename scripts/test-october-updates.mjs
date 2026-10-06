import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {DatabaseSync} from "node:sqlite";
import ts from "typescript";
import {z} from "zod";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import {renderToStaticMarkup} from "react-dom/server";
// Real SQLite, synthetic enquiries only. No network or production writes.
const sqlite=new DatabaseSync(":memory:");
sqlite.exec("CREATE TABLE site_settings (key TEXT PRIMARY KEY,value_json TEXT NOT NULL,updated_at TEXT NOT NULL)");
const db={prepare(sql){let values=[];return {bind(...args){values=args;return this},async first(){return sqlite.prepare(sql).get(...values)||null},async all(){return {results:sqlite.prepare(sql).all(...values)}},async run(){return sqlite.prepare(sql).run(...values)}}},async batch(statements){sqlite.exec("BEGIN");try{const r=await Promise.all(statements.map(s=>s.run()));sqlite.exec("COMMIT");return r}catch(e){sqlite.exec("ROLLBACK");throw e}}};
const context=vm.createContext({console,Request,Response,URL,URLSearchParams,crypto,Date,structuredClone,setTimeout,clearTimeout});
async function module(path,imports,append=""){
 const source=fs.readFileSync(path,"utf8")+append;
 const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const m=new vm.SourceTextModule(code,{context});
 await m.link(name=>{const exports=imports[name];if(!exports)throw Error("Unexpected import "+name);return new vm.SyntheticModule(Object.keys(exports),function(){for(const[k,v]of Object.entries(exports))this.setExport(k,v)},{context})});
 await m.evaluate();return m.namespace;
}
const route=await module("app/api/enquiries/route.ts",{"@/lib/request-limit":{requestAllowed:async()=>true},"@/lib/admin-auth":{isAdminRequest:async r=>r.headers.get("cookie")==="test"},"@/lib/site-data":{getD1:()=>db},zod:{z}});
async function request(method,query="",body,status=200,extra={}){
 const r=await route[method](new Request("https://test.example/api/enquiries"+query,{method,headers:{cookie:"test",origin:"https://test.example",...extra},body:body===undefined?undefined:JSON.stringify(body)}));
 const result=await r.json();assert.equal(r.status,status,JSON.stringify(result));return result;
}
await request("GET","",undefined,401,{cookie:""});
await request("PATCH","",{action:"read",ids:[crypto.randomUUID()]},401,{cookie:""});
await request("PATCH","",{action:"read",ids:[crypto.randomUUID()]},403,{origin:"https://evil.example"});
await request("PATCH","",{action:"wrong",ids:[]},400);
const records=Array.from({length:55},(_,i)=>({id:crypto.randomUUID(),createdAt:new Date(Date.UTC(2026,0,i+1)).toISOString(),name:"Bride "+String(i).padStart(2,"0"),email:"bride"+i+"@example.com",phone:"0400000000",message:i===0?"Silk & lace":"Hello",kind:"Custom bridal",productUrl:""}));
for(const item of records)sqlite.prepare("INSERT INTO site_settings VALUES (?,?,?)").run("enquiry:"+item.id,JSON.stringify(item),item.createdAt);
sqlite.prepare("INSERT INTO site_settings VALUES (?,?,?)").run("studio_v2",JSON.stringify({keep:true}),"now");
assert.equal((await request("GET","?summary=1")).unreadCount,55);
let list=await request("GET");assert.equal(list.items.length,50);assert.equal(list.pages,2);assert.equal(list.items[0].id,records[54].id);
assert.equal((await request("GET","?page=2")).items.length,5);
assert.equal((await request("GET","?sort=oldest")).items[0].id,records[0].id);
assert.equal((await request("GET","?sort=name")).items[0].name,"Bride 00");
assert.equal((await request("GET","?search=Silk")).total,1);
assert.equal((await request("GET","?search=%25")).total,0);
await request("PATCH","",{action:"read",ids:records.slice(0,2).map(x=>x.id)});
assert.equal((await request("GET","?summary=1")).unreadCount,53);
assert.equal((await request("GET","?filter=read")).total,2);
assert.equal((await request("GET","?filter=unread&sort=oldest")).items[0].id,records[2].id);
await request("PATCH","",{action:"unread",ids:[records[0].id]});
await request("PATCH","",{action:"delete",ids:[records[0].id,records[2].id]});
assert.equal((await request("GET","?summary=1")).unreadCount,52);
assert.equal((await request("GET","?filter=trash")).total,2);
assert.equal((await request("GET")).total,53);
await request("PATCH","",{action:"restore",ids:[records[0].id]});
assert.equal((await request("GET","?summary=1")).unreadCount,53);
assert.equal(JSON.parse(sqlite.prepare("SELECT value_json FROM site_settings WHERE key=?").get("enquiry:"+records[0].id).value_json).message,"Silk & lace");
assert.equal(JSON.parse(sqlite.prepare("SELECT value_json FROM site_settings WHERE key='studio_v2'").get().value_json).keep,true);
await request("PATCH","",{action:"read",ids:records.map(x=>x.id)},400);
console.log("PASS: enquiry authorization, origin checks, pagination, search, sorting, read/unread, bulk updates, Trash/restore, preserved content");
const model=await module("lib/studio-model.ts",{zod:{z}});
const wrap=({children})=>React.createElement("div",null,children),empty=()=>null;
const boutique=await module("components/boutique.tsx",{
 react:React,"react/jsx-runtime":jsx,"lucide-react":{ChevronDown:empty,Menu:empty,X:empty,ArrowUpRight:empty},
 "@/components/ui/dialog":{Dialog:empty,DialogContent:wrap,DialogTitle:wrap,DialogDescription:wrap},
 "@/components/ui/dropdown-menu":{DropdownMenu:wrap,DropdownMenuTrigger:wrap,DropdownMenuContent:wrap,DropdownMenuItem:wrap},
 "@/lib/studio-model":model,"./studio":{default:empty},"./gown-viewer":{default:empty},"./reel-wall":{default:empty}
},"\nexport {Storefront,Header};");
const image={id:"m",url:"https://example.com/original.jpg",type:"image",alt:"Original"};
const data=model.publicData(model.studioSchema.parse({version:2,settings:{brandName:"Julie Sufi",announcement:"",contactEmail:"test@example.com",contactPhone:"",studioLocation:"",footerNote:""},home:[],pages:[],collections:[
 {id:"b",slug:"second",name:"First displayed",description:"",published:true,hero:[],cover:[image],products:[{id:"p",slug:"gown",name:"Visible gown",description:"",price:10000,showPrice:false,published:true,media:[image]}]},
 {id:"a",slug:"first",name:"Second displayed",description:"",published:true,hero:[],cover:[],products:[]},
 {id:"hidden",slug:"hidden",name:"Hidden collection",description:"",published:false,hero:[],cover:[],products:[]}
]}));
const html=renderToStaticMarkup(React.createElement(boutique.Storefront,{data,path:"/collections",preview:false}));
assert.match(html,/<h1>All collections<\/h1>/);
assert.equal((html.match(/class="b-sticky-collection"/g)||[]).length,2);
assert.ok(html.indexOf('<h2 class="b-sticky-collection"><a href="/collections/second">')<html.indexOf('<h2 class="b-sticky-collection"><a href="/collections/first">'));
assert.match(html,/Visible gown/);assert.doesNotMatch(html,/Hidden collection|10,000/);
const panel={id:"c",label:"Collections",type:"collections",shown:true,title:"Collections",body:"",media:[],link:"",linkLabel:""};
const home=renderToStaticMarkup(React.createElement(boutique.PanelView,{panel,data}));
assert.ok(home.indexOf("Show all collections")>home.indexOf("Second displayed"));
const split=renderToStaticMarkup(React.createElement(boutique.PanelView,{panel:{...panel,type:"split",media:[image]},data,context:"custom-bridal"}));
assert.match(split,/b-editorial/);assert.match(split,/original.jpg/);
console.log("PASS: all-collections rendering, collection order, product display, hidden-content/price privacy, homepage link, full-frame editorial class");
