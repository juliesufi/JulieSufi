"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {api} from "./boutique";
import {AlertDialog,AlertDialogContent,AlertDialogTitle,AlertDialogDescription,AlertDialogCancel,AlertDialogAction,AlertDialogFooter} from "@/components/ui/alert-dialog";
type Enquiry={id:string;createdAt:string;name:string;email:string;phone:string;message:string;kind:string;productUrl:string;readAt?:string;deletedAt?:string};
type Inbox={items:Enquiry[];total:number;page:number;pages:number;unreadCount:number};
type Action="read"|"unread"|"delete"|"restore";
export function useUnreadEnquiries(){
 const [count,setCount]=useState<number|null>(null);
 useEffect(()=>{
  let active=true;
  const refresh=()=>{if(document.hidden)return;api<{unreadCount:number}>("/api/enquiries?summary=1").then(v=>{if(active)setCount(v.unreadCount);}).catch(()=>{});};
  refresh();const timer=setInterval(refresh,60000);
  window.addEventListener("enquiries-updated",refresh);document.addEventListener("visibilitychange",refresh);
  return()=>{active=false;clearInterval(timer);window.removeEventListener("enquiries-updated",refresh);document.removeEventListener("visibilitychange",refresh);};
 },[]);
 return count;
}
export default function EnquiryInbox(){
 const [data,setData]=useState<Inbox|null>(null),[filter,setFilter]=useState("inbox"),[sort,setSort]=useState("newest"),[search,setSearch]=useState(""),[query,setQuery]=useState(""),[page,setPage]=useState(1);
 const [selected,setSelected]=useState<string[]>([]),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(""),[message,setMessage]=useState(""),[toDelete,setToDelete]=useState<string[]>([]);
 const sequence=useRef(0);
 useEffect(()=>{const timer=setTimeout(()=>{setQuery(search.trim());setPage(1);},250);return()=>clearTimeout(timer);},[search]);
 const load=useCallback(async()=>{
  const current=++sequence.current;setLoading(true);setError("");
  try{
   const params=new URLSearchParams({filter,sort,search:query,page:String(page)});
   const result=await api<Inbox>("/api/enquiries?"+params);
   if(current!==sequence.current)return;
   setData(result);setSelected([]);window.dispatchEvent(new Event("enquiries-updated"));
  }catch(e){if(current===sequence.current)setError((e as Error).message);}
  finally{if(current===sequence.current)setLoading(false);}
 },[filter,sort,query,page]);
 useEffect(()=>{void load();return()=>{sequence.current++;};},[load]);
 async function update(action:Action,ids=selected){
  if(!ids.length)return;setBusy(true);setError("");setMessage("");
  try{
   await api("/api/enquiries",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,ids})});
   setSelected([]);setMessage(action==="delete"?"Moved to Trash. You can restore these enquiries from the Trash filter.":action==="restore"?"Enquiries restored.":"Enquiries marked "+action+".");
   window.dispatchEvent(new Event("enquiries-updated"));await load();
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 const locked=busy||loading,items=data?.items??[],allSelected=items.length>0&&items.every(i=>selected.includes(i.id));
 return <section aria-label="Enquiry inbox">
  <div className="s-heading"><h1>Enquiries</h1><p>Select messages to mark them read or unread, or delete them to Trash. Changes save immediately. Email notifications are not connected; use the email link to reply.</p></div>
  <div className="s-inbox-toolbar">
   <label>Search enquiries<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Name, email, phone or message" disabled={busy}/></label>
   <label>Show<select value={filter} disabled={busy} onChange={e=>{setFilter(e.target.value);setPage(1);setSelected([]);}}><option value="inbox">Inbox</option><option value="unread">Unread</option><option value="read">Read</option><option value="trash">Trash</option></select></label>
   <label>Sort by<select value={sort} disabled={busy} onChange={e=>{setSort(e.target.value);setPage(1);}}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="name">Name A–Z</option><option value="unread">Unread first</option></select></label>
   <button type="button" onClick={()=>void load()} disabled={locked}>Refresh</button>
  </div>
  <div aria-live="polite">{message&&<p className="s-success">{message}</p>}{error&&<p className="s-error" role="alert">{error} <button type="button" onClick={()=>void load()} disabled={busy}>Retry loading</button></p>}{loading&&<p>Loading enquiries…</p>}</div>
  {data&&<><p>{data.total} {filter==="trash"?"deleted":"matching"} enquiries · {data.unreadCount} unread in inbox</p>
   <div className="s-inbox-actions">
    <label className="s-inbox-check"><input type="checkbox" checked={allSelected} disabled={locked||!items.length} onChange={e=>setSelected(e.target.checked?items.map(i=>i.id):[])}/>Select this page</label><span>{selected.length} selected</span>
    {filter==="trash"?<button disabled={locked||!selected.length} onClick={()=>void update("restore")}>Restore selected</button>:<><button disabled={locked||!selected.length} onClick={()=>void update("read")}>Mark read</button><button disabled={locked||!selected.length} onClick={()=>void update("unread")}>Mark unread</button><button disabled={locked||!selected.length} onClick={()=>setToDelete([...selected])}>Delete selected</button></>}
   </div>
   {!items.length&&!loading&&<p className="s-notice">{query?"No enquiries match your search.":filter==="trash"?"Trash is empty.":"No enquiries in this view."}</p>}
   {items.map(item=><article className="s-card s-enquiry" data-unread={!item.readAt&&!item.deletedAt} key={item.id}>
    <div className="s-enquiry-header"><label className="s-inbox-check"><input type="checkbox" aria-label={"Select enquiry from "+item.name} checked={selected.includes(item.id)} disabled={locked} onChange={e=>setSelected(ids=>e.target.checked?[...ids,item.id]:ids.filter(id=>id!==item.id))}/><small>{new Date(item.createdAt).toLocaleString()} · {item.kind}</small></label><span className={!item.readAt?"s-unread":""}>{item.readAt?"Read":"* Unread"}</span></div>
    <h2>{item.name}</h2><a href={"mailto:"+item.email+"?subject="+encodeURIComponent("Re: "+item.kind)}>{item.email}</a><p><a href={"tel:"+item.phone.replace(/[^+0-9]/g,"")}>{item.phone}</a></p>
    {item.productUrl&&<p>Product: <a href={/^https?:\/\//.test(item.productUrl)?item.productUrl:undefined} target="_blank" rel="noreferrer">{item.productUrl}</a></p>}
    <p className="b-prose">{item.message}</p>
    <div className="s-enquiry-actions">{item.deletedAt?<button disabled={locked} onClick={()=>void update("restore",[item.id])}>Restore enquiry</button>:<><button disabled={locked} onClick={()=>void update(item.readAt?"unread":"read",[item.id])}>Mark {item.readAt?"unread":"read"}</button><button disabled={locked} onClick={()=>setToDelete([item.id])}>Delete enquiry</button></>}</div>
   </article>)}
   <div className="s-inbox-pagination"><button disabled={locked||data.page<=1} onClick={()=>setPage(data.page-1)}>Previous</button><span>Page {data.page} of {data.pages}</span><button disabled={locked||data.page>=data.pages} onClick={()=>setPage(data.page+1)}>Next</button></div>
  </>}
  <AlertDialog open={toDelete.length>0} onOpenChange={open=>{if(!open)setToDelete([]);}}><AlertDialogContent className="s-dialog"><AlertDialogTitle>Delete {toDelete.length} {toDelete.length===1?"enquiry":"enquiries"}?</AlertDialogTitle><AlertDialogDescription>These messages will move to Trash immediately. You can restore them later.</AlertDialogDescription><AlertDialogFooter><AlertDialogCancel>Keep enquiries</AlertDialogCancel><AlertDialogAction onClick={()=>{void update("delete",toDelete);setToDelete([]);}}>Move to Trash</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
 </section>;
}
