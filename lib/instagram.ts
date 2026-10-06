import { env } from "cloudflare:workers";
import { getD1 } from "./site-data";

// Instagram is a content connection, independent of the site's login and Shopify.
export const INSTAGRAM_ORIGIN = "https://julie-sufi-bridal.batmams23.chatgpt.site";
export const INSTAGRAM_CALLBACK = INSTAGRAM_ORIGIN + "/api/admin/instagram/callback";
const KEY = "instagram_connection_v1";
const GRAPH = "https://graph.instagram.com/v25.0";
const DAY = 86400000;
export type InstagramReel = { id: string; url: string; poster: string; link: string; caption: string };
type Connection = {
  appId: string; secret: string; token?: string; userId?: string; username?: string;
  expiresAt?: number; refreshedAt?: number; syncedAt?: number; nextSync?: number; lockUntil?: number;
  reels: InstagramReel[]; issue?: string;
};
type Stored = { value: Connection; revision: string };
function db() { const d = getD1(); if (!d) throw new Error("Instagram settings are unavailable. Please retry."); return d; }
async function read(): Promise<Stored | null> {
  const row = await db().prepare("SELECT value_json, updated_at FROM site_settings WHERE key = ?").bind(KEY).first<{value_json: string; updated_at: string}>();
  return row ? { value: JSON.parse(row.value_json), revision: row.updated_at } : null;
}
async function save(value: Connection, previous: Stored | null): Promise<Stored> {
  const revision = crypto.randomUUID();
  const r = previous
    ? await db().prepare("UPDATE site_settings SET value_json = ?, updated_at = ? WHERE key = ? AND updated_at = ?").bind(JSON.stringify(value), revision, KEY, previous.revision).run()
    : await db().prepare("INSERT OR IGNORE INTO site_settings (key,value_json,updated_at) VALUES (?,?,?)").bind(KEY, JSON.stringify(value), revision).run();
  if (!r.meta.changes) throw new Error("Instagram settings changed in another request. Please retry.");
  return { value, revision };
}
async function cipherKey() {
  const secret = (env as unknown as {INSTAGRAM_ENCRYPTION_KEY?: string}).INSTAGRAM_ENCRYPTION_KEY;
  if (!secret) throw new Error("Secure Instagram storage needs configuration.");
  return crypto.subtle.importKey("raw", Uint8Array.from(atob(secret), c => c.charCodeAt(0)), "AES-GCM", false, ["encrypt", "decrypt"]);
}
function encode(b: Uint8Array) { return btoa(String.fromCharCode(...b)); }
async function seal(value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({name: "AES-GCM", iv}, await cipherKey(), new TextEncoder().encode(value));
  return encode(iv) + "." + encode(new Uint8Array(data));
}
async function unseal(value: string) {
  const [iv, data] = value.split(".").map(x => Uint8Array.from(atob(x), c => c.charCodeAt(0)));
  return new TextDecoder().decode(await crypto.subtle.decrypt({name:"AES-GCM", iv}, await cipherKey(), data));
}
export class InstagramError extends Error {
  constructor(public expired = false) { super(expired ? "Instagram access has expired or been revoked. Please reconnect @juliesufi." : "Instagram could not complete the request. Check the app settings and try again."); }
}
async function meta<T>(url: string | URL, init?: RequestInit): Promise<T> {
  // Never log URLs or Meta's raw error objects: they can contain credentials.
  const response = await fetch(url, {...init, signal: AbortSignal.timeout(12000)});
  const body = await response.json() as T & {error?: {code?: number}};
  if (!response.ok || body.error) throw new InstagramError(body.error?.code === 190);
  return body;
}
function https(value: unknown, instagram = false): string {
  try { const u = new URL(String(value)); return u.protocol === "https:" && !u.username && !u.password && (!instagram || ["instagram.com", "www.instagram.com"].includes(u.hostname)) ? u.href : ""; } catch { return ""; }
}
async function fetchReels(token: string, userId: string): Promise<InstagramReel[]> {
  const reels: InstagramReel[] = []; let after = "";
  for (let page = 0; page < 4 && reels.length < 24; page++) {
    const url = new URL(GRAPH + "/" + encodeURIComponent(userId) + "/media");
    url.search = new URLSearchParams({fields:"id,media_type,media_product_type,media_url,thumbnail_url,permalink,caption", limit:"50", ...(after ? {after} : {})}).toString();
    const data = await meta<{data: Record<string, unknown>[]; paging?: {next?: string; cursors?: {after?: string}}}>(url, {headers:{Authorization:"Bearer " + token}});
    if (!Array.isArray(data.data)) throw new InstagramError();
    for (const m of data.data) {
      const link = https(m.permalink, true), url = https(m.media_url), poster = https(m.thumbnail_url);
      if (m.media_product_type === "REELS" && m.media_type === "VIDEO" && link && (url || poster))
        reels.push({id:String(m.id), url, poster, link, caption:String(m.caption || "Julie Sufi reel").slice(0, 500)});
    }
    after = data.paging?.next ? data.paging.cursors?.after || "" : "";
    if (!after) break;
  }
  return reels.slice(0, 24);
}
export async function instagramStatus() {
  const s = (await read())?.value;
  return { configured:!!s?.secret, connected:!!s?.token, appId:s?.appId || "", username:s?.username || "", expiresAt:s?.expiresAt || null, syncedAt:s?.syncedAt || null, count:s?.reels.length || 0, issue:s?.issue || "", callback:INSTAGRAM_CALLBACK };
}
export async function configureInstagram(appId: string, secret: string) {
  if (!/^\d{5,40}$/.test(appId) || secret.length < 16 || secret.length > 300) throw new Error("Enter the Instagram App ID and App Secret from Meta's Instagram setup screen.");
  const current = await read();
  // Editing an active app would invalidate its connection. Disconnect explicitly first.
  if (current?.value.token) throw new Error("Disconnect Instagram before replacing the app credentials.");
  await save({appId, secret:await seal(secret), reels:[]}, current);
}
export async function beginInstagram() {
  const s = await read(); if (!s?.value.secret) throw new Error("Complete the one-time Meta app setup first.");
  const state = crypto.randomUUID() + crypto.randomUUID();
  await db().prepare("DELETE FROM site_settings WHERE key LIKE 'instagram_oauth_%' AND updated_at < ?").bind(String(Date.now() - 600000)).run();
  await db().prepare("INSERT INTO site_settings (key,value_json,updated_at) VALUES (?,?,?)").bind("instagram_oauth_" + state, JSON.stringify({revision:s.revision}), String(Date.now())).run();
  const url = new URL("https://www.instagram.com/oauth/authorize");
  url.search = new URLSearchParams({client_id:s.value.appId, redirect_uri:INSTAGRAM_CALLBACK, response_type:"code", scope:"instagram_business_basic", enable_fb_login:"0", force_authentication:"1", state}).toString();
  return { url:url.href, state };
}
export async function finishInstagram(code: string, state: string) {
  const pending = await db().prepare("DELETE FROM site_settings WHERE key = ? AND updated_at >= ? RETURNING value_json").bind("instagram_oauth_" + state, String(Date.now()-600000)).first<{value_json:string}>();
  const s = await read();
  if (!pending || !s || JSON.parse(pending.value_json).revision !== s.revision) throw new Error("The connection request expired. Please start again.");
  const secret = await unseal(s.value.secret);
  const short = await meta<{access_token?:string; data?:{access_token:string}[]}>("https://api.instagram.com/oauth/access_token", {method:"POST", body:new URLSearchParams({client_id:s.value.appId, client_secret:secret, grant_type:"authorization_code", redirect_uri:INSTAGRAM_CALLBACK, code})});
  const shortToken = short.access_token || short.data?.[0]?.access_token;
  if (!shortToken) throw new InstagramError();
  const url = new URL("https://graph.instagram.com/access_token");
  url.search = new URLSearchParams({grant_type:"ig_exchange_token", client_secret:secret, access_token:shortToken}).toString();
  const token = await meta<{access_token:string; expires_in:number}>(url);
  if (!token.access_token || !(token.expires_in > 0)) throw new InstagramError();
  const profile = await meta<{user_id?:string; id?:string; username:string}>(GRAPH + "/me?fields=user_id,username", {headers:{Authorization:"Bearer " + token.access_token}});
  if (profile.username?.toLowerCase() !== "juliesufi") throw new Error("Please authorise @juliesufi. The selected account was not connected.");
  const userId = String(profile.user_id || profile.id || "");
  if (!/^\d+$/.test(userId)) throw new InstagramError();
  await save({...s.value, token:await seal(token.access_token), userId, username:profile.username, expiresAt:Date.now()+token.expires_in*1000, refreshedAt:Date.now(), nextSync:0, syncedAt:0, reels:[], issue:""}, s);
  await syncInstagram();
}
export async function disconnectInstagram() {
  const s = await read();
  if (s) await save({appId:s.value.appId, secret:s.value.secret, reels:[]}, s);
}
export async function syncInstagram(force = false) {
  let s = await read(); if (!s?.value.token) return;
  const now = Date.now();
  if ((s.value.lockUntil || 0) > now) return;
  if ((s.value.nextSync || 0) > now && (!force || (s.value.syncedAt || 0) > now - 60000)) return;
  // A compare-and-swap lease prevents simultaneous visitors refreshing the token.
  try { s = await save({...s.value, lockUntil:now+90000}, s); } catch { return; }
  let next = {...s.value};
  try {
    if ((next.expiresAt || 0) <= now) throw new InstagramError(true);
    let token = await unseal(next.token!);
    if (now - (next.refreshedAt || 0) > 7 * DAY) {
      const url = new URL("https://graph.instagram.com/refresh_access_token");
      url.search = new URLSearchParams({grant_type:"ig_refresh_token", access_token:token}).toString();
      const renewed = await meta<{access_token:string; expires_in:number}>(url);
      if (!renewed.access_token || !(renewed.expires_in > 0)) throw new InstagramError();
      token = renewed.access_token;
      next = {...next, token:await seal(token), refreshedAt:now, expiresAt:now+renewed.expires_in*1000};
    }
    next = {...next, reels:await fetchReels(token, next.userId!), syncedAt:now, nextSync:now+15*60000, issue:""};
  } catch (e) {
    next = {...next, nextSync:now+5*60000, issue:e instanceof InstagramError ? e.message : "Instagram is temporarily unavailable. We will retry automatically."};
    if (e instanceof InstagramError && e.expired) next = {...next, reels:[], token:undefined};
  }
  // Disconnection/reconnection during a fetch must never be overwritten.
  try { await save({...next, lockUntil:0}, s); } catch { /* A newer admin action takes precedence. */ }
}
export async function instagramFeed() {
  await syncInstagram();
  const s = (await read())?.value;
  return {connected:!!s?.token, reels:s?.token && Date.now()-(s.syncedAt || 0)<DAY ? s.reels : []};
}
