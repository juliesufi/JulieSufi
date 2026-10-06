"use client";
import { useEffect, useState } from "react";
import { api } from "./boutique";
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogCancel, AlertDialogAction, AlertDialogFooter } from "@/components/ui/alert-dialog";
type Status = {configured:boolean; connected:boolean; appId:string; username:string; expiresAt:number|null; syncedAt:number|null; count:number; issue:string; callback:string};
export default function InstagramSettings() {
  const [status,setStatus] = useState<Status|null>(null), [error,setError] = useState(""), [message,setMessage] = useState(""), [busy,setBusy] = useState(false);
  const [appId,setAppId] = useState(""), [secret,setSecret] = useState(""), [confirm,setConfirm] = useState(false);
  useEffect(() => {
    api<Status>("/api/admin/instagram").then(s => {setStatus(s); setAppId(s.appId);}).catch(e => setError(e.message));
    const result = new URLSearchParams(location.search).get("instagram");
    if (result === "connected") setMessage("Instagram authorised. Check the sync status below.");
    else if (result) setError(result === "cancelled" ? "Instagram authorisation was cancelled. You can try again." : result === "wrong_account" ? "Please sign into @juliesufi when connecting." : "Instagram could not connect. Check the app settings, account access and callback URL, then try again.");
  }, []);
  async function action(action: string) {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await api<Status & {url?:string}>("/api/admin/instagram", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({action, ...(action === "configure" ? {appId,secret} : {})})});
      if (response.url) {location.assign(response.url); return;}
      setStatus(response); setSecret("");
      setMessage(action === "configure" ? "App settings saved. You can now connect @juliesufi." : action === "disconnect" ? "Disconnected. The synced reels have been removed from this website." : response.issue ? "" : "Instagram feed checked.");
    } catch (e) {setError((e as Error).message);} finally {setBusy(false);}
  }
  return <><div className="s-heading"><h1>Instagram</h1><p>Connect @juliesufi to show your latest reels automatically.</p></div><div aria-live="polite">{error && <p className="s-error" role="alert">{error}</p>}{message && <p className="s-success">{message}</p>}</div>{!status ? <p>Loading connection settings…</p> : <>
    <section className="s-card"><h2>{status.connected ? "Connected to @" + status.username : "Not connected"}</h2>
      {status.connected ? <><p>{status.count} reels · {status.syncedAt ? "Last synced " + new Date(status.syncedAt).toLocaleString() : "Waiting for the first sync"}</p><p>The website checks for new reels when someone visits, up to once every 15 minutes. It displays up to 24 reels from your 200 most recent posts.</p><p>Instagram access renews automatically while the website is being visited. After a long period without visits, or if you remove access in Instagram, you may need to reconnect.</p></> : <p>{status.configured ? "The app settings are saved. Authorise @juliesufi through Instagram to start syncing." : "A one-time Meta app setup is needed before Instagram can authorise this website. Your Instagram account must be a Business or Creator account."}</p>}
      {status.issue && <p className="s-error">{status.issue}</p>}
      <div className="s-actions"><button type="button" className="s-primary" disabled={busy || !status.configured} onClick={() => action("connect")}>{busy ? "Please wait…" : status.connected ? "Reconnect Instagram" : "Connect @juliesufi"}</button>{status.connected && <><button type="button" disabled={busy} onClick={() => action("sync")}>Sync now</button><button type="button" disabled={busy} onClick={() => setConfirm(true)}>Disconnect</button></>}</div>
    </section>
    {!status.connected && <section className="s-card"><h2>One-time connection setup</h2><ol><li>Open <a href="https://developers.facebook.com/apps/" target="_blank" rel="noreferrer">Meta for Developers</a> and create or open the app for Julie Sufi.</li><li>Add the Instagram API with Instagram Login. Add @juliesufi as an authorised account/tester and accept any invitation in Instagram.</li><li>In the Instagram business login settings, add this exact redirect URL:<p style={{overflowWrap:"anywhere"}}><code>{status.callback}</code></p><button type="button" onClick={() => navigator.clipboard.writeText(status.callback).then(() => setMessage("Redirect URL copied.")).catch(() => setError("Select and copy the redirect URL above."))}>Copy redirect URL</button></li><li>Enter the Instagram App ID and Instagram App Secret below. These are from the Instagram setup screen, not your Instagram password.</li></ol>
      <p>Request only basic profile and media access (instagram_business_basic). Meta may require further account verification or review depending on the app's access level. <a href="https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/get-started" target="_blank" rel="noreferrer">Meta setup instructions</a></p>
      <label className="s-field"><span>Instagram App ID</span><input autoComplete="off" inputMode="numeric" value={appId} onChange={e => setAppId(e.target.value)} disabled={busy}/></label>
      <label className="s-field"><span>Instagram App Secret</span><input type="password" autoComplete="new-password" value={secret} onChange={e => setSecret(e.target.value)} disabled={busy} placeholder={status.configured ? "Saved securely — enter only to replace" : "Paste your app secret here"}/><small>Encrypted on the server. Never included in public website data.</small></label>
      <button type="button" disabled={busy || !appId || !secret} onClick={() => action("configure")}>Save connection settings</button>
    </section>}
    <section className="s-card"><h2>Your reel wall</h2><p>Once connected, synced reels appear in every shown Instagram panel. Your uploaded clips and saved reel links stay in the editor and are used when Instagram is disconnected. Set the panel's size and visibility under Home page.</p><p>Connection settings take effect immediately; they do not need Save &amp; publish.</p></section>
  </>}
  <AlertDialog open={confirm} onOpenChange={setConfirm}><AlertDialogContent className="s-dialog"><AlertDialogTitle>Disconnect Instagram?</AlertDialogTitle><AlertDialogDescription>This removes the saved account token and synced reels from this website immediately. Your Instagram posts are unchanged. You can also remove the app's permission in Instagram's Apps and websites settings.</AlertDialogDescription><AlertDialogFooter><AlertDialogCancel>Keep connected</AlertDialogCancel><AlertDialogAction onClick={() => action("disconnect")}>Disconnect</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></>;
}
