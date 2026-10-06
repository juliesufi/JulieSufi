import {getD1} from "./site-data";
// Atomic per-IP fixed windows, shared across Worker instances. Never store raw IPs.
export async function requestAllowed(request: Request, scope: "login" | "enquiry", maximum: number, seconds: number) {
 const db=getD1(); if(!db) throw new Error("Request protection unavailable");
 const identity=request.headers.get("cf-connecting-ip") || "unknown";
 const hash=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(scope+":"+identity));
 const key="request-limit:"+scope+":"+Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,"0")).join("");
 const window=Math.floor(Date.now()/1000/seconds),now=new Date().toISOString();
 const row=await db.prepare(`INSERT INTO site_settings (key,value_json,updated_at) VALUES (?,json_object('window',?,'count',1),?)
 ON CONFLICT(key) DO UPDATE SET value_json=json_object('window',?,'count',
 CASE WHEN json_extract(site_settings.value_json,'$.window')=? THEN json_extract(site_settings.value_json,'$.count')+1 ELSE 1 END),updated_at=excluded.updated_at
 RETURNING value_json`).bind(key,window,now,window,window).first<{value_json:string}>();
 if(!row)throw new Error("Request protection unavailable");
 // Periodically trim only expired limiter records; never touch customer content.
 if(crypto.getRandomValues(new Uint8Array(1))[0]===0)
  await db.prepare("DELETE FROM site_settings WHERE key GLOB 'request-limit:*' AND updated_at < ?").bind(new Date(Date.now()-86400000).toISOString()).run();
 return JSON.parse(row.value_json).count<=maximum;
}
