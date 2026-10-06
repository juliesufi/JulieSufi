"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Plus, ArrowLeft, Upload, ExternalLink, Save, Trash2 } from "lucide-react";
import EnquiryInbox, {useUnreadEnquiries} from "./enquiry-inbox";
import MediaQuality from "./media-quality";
import InstagramSettings from "./instagram-settings";
import { uploadMedia } from "@/lib/upload-client";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogCancel, AlertDialogAction, AlertDialogFooter } from "@/components/ui/alert-dialog";
import { newPanel, moveTo, slugify, type StudioData, type Panel, type Media, type Product, type Collection, type Page } from "@/lib/studio-model";
import { api, Asset } from "./boutique";
const UploadContext = createContext<(busy: boolean) => void>(() => { });
function LogoEditor({logo,onChange}: {logo?:Media;onChange:(logo:Media|undefined)=>void}) {
    const setGlobalBusy=useContext(UploadContext), [busy,setBusy]=useState(false), [error,setError]=useState("");
    return <section><h2>Website logo</h2><p>Upload a PNG, JPEG or WebP logo for the header. A transparent PNG works best. Save &amp; publish to apply it.</p>{logo && <div className="s-logo-preview"><img src={logo.url} alt="Current website logo"/></div>}<label className="s-upload"><Upload size={18}/>{busy?"Uploading…":"Upload / replace logo"}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={async e=>{const file=e.target.files?.[0];e.target.value="";if(!file)return;setBusy(true);setGlobalBusy(true);setError("");try {if(!["image/png","image/jpeg","image/webp"].includes(file.type))throw new Error("Choose a PNG, JPEG or WebP logo.");const result=await uploadMedia(file,()=>{});onChange({id:crypto.randomUUID(),url:result.url,type:"image",alt:"Julie Sufi"});}catch(e){setError((e as Error).message);}finally{setBusy(false);setGlobalBusy(false);}}}/></label>{logo && <button type="button" disabled={busy} onClick={()=>onChange(undefined)}>Use text logo instead</button>}{error && <p className="s-error" role="alert">{error}</p>}</section>;
}
type Tab = "home" | "pages" | "collections" | "enquiries" | "settings" | "instagram";
type Envelope = {
    data: StudioData;
    revision: string;
    publishedAt: string | null;
};
function Field({ label, children, hint }: {
    label: string;
    children: ReactNode;
    hint?: string;
}) { return <label className="s-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>; }
function Order({ value, max, onChange, label }: {
    value: number;
    max: number;
    onChange: (v: number) => void;
    label: string;
}) {
    const [input, setInput] = useState(String(value));
    useEffect(() => setInput(String(value)), [value]);
    return <input aria-label={label} type="number" min={1} max={max} value={input} onChange={e => setInput(e.target.value)} onBlur={() => { const n = Math.max(1, Math.min(max, Math.round(Number(input) || value))); setInput(String(n)); onChange(n); }} onKeyDown={e => {
            if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.blur();
            }
        }}/>;
}
function Text({ label, value, onChange, large = false }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    large?: boolean;
}) { return <Field label={label}>{large ? <textarea rows={6} value={value} onChange={e => onChange(e.target.value)}/> : <input value={value} onChange={e => onChange(e.target.value)}/>}</Field>; }
function Check({ label, value, onChange }: {
    label: string;
    value: boolean;
    onChange: (v: boolean) => void;
}) { return <label className="s-check"><Checkbox checked={value} onCheckedChange={v => onChange(v === true)}/>{label}</label>; }
function Choice({ label, value, onChange, options }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: [
        string,
        string
    ][];
}) { return <Field label={label}><Select value={value || "__none"} onValueChange={v => onChange(v === "__none" ? "" : v)}><SelectTrigger className="s-select"><SelectValue /></SelectTrigger><SelectContent className="s-select-content">{options.map(([v, l]) => <SelectItem key={v || "__none"} value={v || "__none"}>{l}</SelectItem>)}</SelectContent></Select></Field>; }
function ReelLinks({ panel, onChange }: {
    panel: Panel;
    onChange: (urls: string[]) => void;
}) {
    const [text, setText] = useState((panel.reelUrls ?? (panel.reelUrl ? [panel.reelUrl] : [])).join("\n"));
    return <Field label="Instagram reel links — one URL per line" hint="Paste a link, then press Enter to add another. Upload videos above for borderless tiles."><textarea rows={5} value={text} onChange={e => setText(e.target.value)} onBlur={() => { const urls = text.split("\n").map(s => s.trim()).filter(Boolean).map(s => { try {
        const u = new URL(s);
        return u.origin + u.pathname;
    }
    catch {
        return s;
    } }); setText(urls.join("\n")); onChange(urls); }}/></Field>;
}
function HeightControl({ value, onChange, label = "Panel height", media = [], kind = "panel" }: {
    value?: number;
    onChange: (v: number) => void;
    label?: string;
    media?: Media[];
    kind?: string;
}) {
    const amount = value ?? 50, asset = media.find(m => m.shown !== false);
    return <section className="s-height-control"><h3>{label}</h3><p>Drag to make this area shorter or taller. Content always has enough room to stay readable. For image-left/text-right panels, this adjusts the surrounding space; photos keep their full proportions.</p><div className={"s-height-preview s-height-" + kind}><div style={{ minHeight: kind === "header" ? 30 + amount * .5 : 65 + amount * 1.4 }}>{asset ? (asset.type === "image" ? <img src={asset.url} alt="Panel height preview"/> : <video src={asset.url} muted playsInline preload="metadata"/>) : null}<span>{kind === "header" ? "Julie Sufi · Collections · Custom Bridal" : kind === "footer" ? "Julie Sufi · Explore · Information · Connect" : "Your panel content"}</span></div></div><div className="s-height-labels"><span>Shorter</span><span>Taller</span></div><Slider aria-label={label} value={[amount]} min={0} max={100} step={1} onValueChange={v => onChange(v[0])}/></section>;
}
function Delete({ label, onDelete, detail = "This removes it from the draft. The live website changes only after publishing." }: {
    label: string;
    onDelete: () => void;
    detail?: string;
}) {
    const [open, setOpen] = useState(false);
    return <><button type="button" className="s-delete" onClick={() => setOpen(true)} aria-label={"Delete " + label}><Trash2 size={16}/>Delete</button><AlertDialog open={open} onOpenChange={setOpen}><AlertDialogContent className="s-dialog"><AlertDialogTitle>Delete {label}?</AlertDialogTitle><AlertDialogDescription>{detail}</AlertDialogDescription><AlertDialogFooter><AlertDialogCancel>Keep it</AlertDialogCancel><AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></>;
}
export default function Studio() {
    const unreadCount = useUnreadEnquiries();
    const [value, setValue] = useState<Envelope | null>(null), [baseline, setBaseline] = useState(""), [tab, setTab] = useState<Tab>("home"), [selection, setSelection] = useState(""), [message, setMessage] = useState(""), [error, setError] = useState(""), [saving, setSaving] = useState(false), [uploading, setUploading] = useState(false);
    useEffect(() => { if (new URLSearchParams(location.search).has("instagram")) setTab("instagram"); }, []);
    const dirty = !!value && JSON.stringify(value.data) !== baseline;
    useEffect(() => { api<Envelope>("/api/admin/data").then((v: Envelope) => { setValue(v); setBaseline(JSON.stringify(v.data)); }).catch(e => setError(e.message)); }, []);
    useEffect(() => {
        const warn = (e: BeforeUnloadEvent) => {
            if (dirty || uploading) {
                e.preventDefault();
                e.returnValue = "";
            }
        };
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [dirty, uploading]);
    function update(fn: (data: StudioData) => void) {
        setValue(v => {
            if (!v)
                return v;
            const data = structuredClone(v.data);
            fn(data);
            return { ...v, data };
        });
        setMessage("");
    }
    async function save(publish = false) {
        if (!value)
            return;
        setSaving(true);
        setError("");
        setMessage("");
        try {
            const next = await api<Envelope>("/api/admin/data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: value.data, revision: value.revision, publish }) });
            setValue(next);
            setBaseline(JSON.stringify(next.data));
            setMessage(publish ? "Published. The website now shows these changes." : "Draft saved. The live website is unchanged.");
        }
        catch (e) {
            setError((e as Error).message);
        }
        finally {
            setSaving(false);
        }
    }
    const data = value?.data;
    function changeTab(t: Tab) { setTab(t); setSelection(""); }
    const page = data?.pages.find(p => p.id === selection), collection = data?.collections.find(c => c.id === selection);
    return <UploadContext.Provider value={setUploading}><div className="studio-v2"><aside className="s-sidebar"><a className="s-brand" href="/">Julie Sufi<small>STUDIO EDITOR</small></a><nav aria-label="Studio navigation">{([["home", "Home page"], ["pages", "Pages"], ["collections", "Collections"], ["enquiries", "Enquiries"], ["instagram", "Instagram"], ["settings", "Site details"]] as [
            Tab,
            string
        ][]).map(([id, label]) => <button disabled={saving || uploading} className={tab === id ? "active" : ""} onClick={() => changeTab(id)} key={id} aria-label={id==="enquiries" && unreadCount ? "Enquiries, "+unreadCount+" unread" : label}>{label}{id==="enquiries" && !!unreadCount && <span className="s-unread" title={unreadCount+" unread enquiries"} aria-hidden="true">*</span>}</button>)}</nav><div className="s-sidebar-bottom"><a href="/" target="_blank" rel="noreferrer">View website <ExternalLink size={14}/></a><button disabled={dirty || uploading || saving} onClick={async () => {
            try {
                await api("/api/admin/logout", { method: "POST" });
                location.href = "/";
            }
            catch (e) {
                setError((e as Error).message);
            }
        }}>Sign out</button></div></aside><div className="s-workspace"><header className="s-topbar"><div><strong>{dirty ? "Unsaved changes" : "Draft saved"}</strong><small>{value?.publishedAt ? "Last published " + new Date(value.publishedAt).toLocaleString() : "Ready to edit"}</small></div><div className="s-actions"><a href="/?preview=1" target="_blank" rel="noreferrer" title="Save your draft first to preview the latest edits">Preview saved draft <ExternalLink size={14}/></a><button disabled={!data || saving || uploading} onClick={() => save()}><Save size={16}/>Save draft</button><button className="s-primary" disabled={!data || saving || uploading} onClick={() => save(true)}>{saving ? "Saving…" : "Save & publish"}</button></div></header><main className="s-main"><div aria-live="polite">{message && <p className="s-success">{message}</p>}{error && <p className="s-error" role="alert">{error}</p>}{uploading && <p className="s-notice">Uploading media. Please keep this page open.</p>}</div>{!data ? <p>{error ? <button onClick={() => location.reload()}>Retry loading the editor</button> : "Loading your saved content…"}</p> : <fieldset disabled={saving || uploading} inert={saving || uploading} className="s-editor-fieldset">
 {tab === "home" && <><Heading title="Home page" text="Click a panel to edit its content. Set an order number to move it; show or hide it without deleting."/><div className="s-card"><LogoEditor logo={data.settings.logo} onChange={logo=>update(d=>{d.settings.logo=logo;})}/></div><PanelEditor panels={data.home} onChange={panels => update(d => { d.home = panels; })} data={data}/></>}
 {tab === "pages" && (!page ? <><Heading title="Pages" text="Every content page is listed here. Collection and product pages are edited under Collections."/><div className="s-list"><button className="s-record" onClick={() => changeTab("home")}><strong>Home page</strong><span>Edit home panels →</span></button>{data.pages.map(p => <button className="s-record" key={p.id} onClick={() => setSelection(p.id)}><span><strong>{p.label}</strong><small>/pages/{p.slug}</small></span><span>{p.published ? "Shown" : "Hidden"} · Edit →</span></button>)}</div><button className="s-add" onClick={() => { const id = crypto.randomUUID(); update(d => { d.pages.push({ id, slug: "new-page-" + id.slice(0, 8), label: "New page", published: false, panels: [newPanel("split", "Introduction")] }); }); setSelection(id); }}><Plus size={17}/>Add page</button></> : <><Back label="All pages" onClick={() => setSelection("")}/><Heading title={page.label}/><div className="s-card"><div className="s-two"><Text label="Page name" value={page.label} onChange={v => update(d => { d.pages.find(p => p.id === page.id)!.label = v; })}/><Field label="Page URL" hint="Built-in navigation pages keep their URLs so header and footer links continue to work."><input value={page.slug} disabled={["about-us", "contact-us", "custom-bridal", "retailers", "terms-policy", "faqs", "terms-of-use", "privacy-policy", "return-policy"].includes(page.slug)} onChange={e => { const v = slugify(e.target.value); update(d => { const p = d.pages.find(p => p.id === page.id)!; const before = "/pages/" + p.slug; p.slug = v; rewriteLinks(d, before, "/pages/" + v); }); }}/></Field></div><Check label="Show this page on the website" value={page.published} onChange={v => update(d => { d.pages.find(p => p.id === page.id)!.published = v; })}/><a href={"/pages/" + page.slug + "?preview=1"} target="_blank" rel="noreferrer">Preview saved page ↗</a></div><PanelEditor key={page.id} panels={page.panels} data={data} onChange={panels => update(d => { d.pages.find(p => p.id === page.id)!.panels = panels; })}/>{!["about-us", "contact-us", "custom-bridal", "retailers", ...["terms-policy", "faqs", "terms-of-use", "privacy-policy", "return-policy"]].includes(page.slug) && <Delete label={page.label} onDelete={() => { update(d => { d.pages = d.pages.filter(p => p.id !== page.id); rewriteLinks(d, "/pages/" + page.slug, ""); }); setSelection(""); }}/>}</>)}
 {tab === "collections" && (!collection ? <><Heading title="Collections" text="Open a collection to edit its campaign media, home-page display, and products."/><div className="s-list">{data.collections.map((c, index) => <div className="s-record" key={c.id}><div className="s-thumb">{c.cover[0] && <Asset item={c.cover[0]}/>}</div><button className="s-title-link" onClick={() => setSelection(c.id)}><strong>{c.name}</strong><small>{c.products.length} products · {c.published ? "Shown" : "Hidden"}</small></button><Field label="Order"><Order label={"Order of " + c.name} max={data.collections.length} value={index + 1} onChange={v => update(d => { d.collections = moveTo(d.collections, index, v); })}/></Field></div>)}</div><button className="s-add" onClick={() => { const id = crypto.randomUUID(); update(d => { d.collections.push({ id, slug: "new-collection-" + id.slice(0, 8), name: "New collection", description: "", published: false, hero: [], cover: [], products: [] }); }); setSelection(id); }}><Plus size={17}/>Add collection</button></> : <CollectionEditor key={collection.id} collection={collection} onBack={() => setSelection("")} onChange={next => update(d => {
                    const old = d.collections.find(c => c.id === next.id)!;
                    for (const p of old.products) {
                        const updated = next.products.find(q => q.id === p.id);
                        if (!updated || updated.slug !== p.slug)
                            rewriteLinks(d, "/products/" + p.slug, updated ? "/products/" + updated.slug : "");
                    }
                    if (old.slug !== next.slug)
                        rewriteLinks(d, "/collections/" + old.slug, "/collections/" + next.slug);
                    d.collections = d.collections.map(c => c.id === next.id ? next : c);
                })} onDelete={() => {
                    update(d => {
                        for (const p of collection.products)
                            rewriteLinks(d, "/products/" + p.slug, "");
                        d.collections = d.collections.filter(c => c.id !== collection.id);
                        rewriteLinks(d, "/collections/" + collection.slug, "");
                    });
                    setSelection("");
                }}/>)}
 {tab === "enquiries" && <EnquiryInbox />}
 {tab === "instagram" && <InstagramSettings />}
 {tab === "settings" && <><Heading title="Site details" text="These details appear in your header, footer and enquiry forms."/><div className="s-card">{([["brandName", "Brand name"], ["announcement", "Header announcement"], ["contactEmail", "Contact email"], ["contactPhone", "Phone"], ["studioLocation", "Studio location"], ["footerNote", "Footer blurb"]] as [
                    keyof StudioData["settings"],
                    string
                ][]).map(([key, label]) => <Text key={key} label={label} value={String(data.settings[key] ?? "")} onChange={v => update(d => { (d.settings as Record<string, unknown>)[key] = v; })}/>)}<HeightControl label="Header height" kind="header" value={data.settings.headerHeight} onChange={v => update(d => { d.settings.headerHeight = v; })}/><HeightControl label="Footer height" kind="footer" value={data.settings.footerHeight} onChange={v => update(d => { d.settings.footerHeight = v; })}/></div></>}
 </fieldset>}</main></div></div></UploadContext.Provider>;
}
function rewriteLinks(d: StudioData, before: string, after: string) {
    for (const p of [...d.home, ...d.pages.flatMap(p => p.panels)])
        if (p.link === before)
            p.link = after;
}
function Heading({ title, text }: {
    title: string;
    text?: string;
}) { return <div className="s-heading"><h1>{title}</h1>{text && <p>{text}</p>}</div>; }
function Back({ label, onClick }: {
    label: string;
    onClick: () => void;
}) { return <button className="s-back" onClick={onClick}><ArrowLeft size={16}/>{label}</button>; }
const panelTypes: [
    Panel["type"],
    string
][] = [["hero", "Full-width hero"], ["collections", "Collection cards"], ["split", "Image left / text right"], ["instagram", "Instagram reels"], ["text", "Compact text & link"], ["contact", "Contact enquiry form"]];
function PanelEditor({ panels, onChange, data }: {
    panels: Panel[];
    onChange: (p: Panel[]) => void;
    data: StudioData;
}) {
    const [selected, setSelected] = useState(""), [newType, setNewType] = useState<Panel["type"]>("split");
    const panel = panels.find(p => p.id === selected);
    function edit(next: Panel) { onChange(panels.map(p => p.id === next.id ? next : p)); }
    const links: [
        string,
        string
    ][] = [["", "No link"], ["/", "Home"], ["/collections", "All collections"], ...data.pages.map(p => ["/pages/" + p.slug, p.label + (p.published ? "" : " (hidden)")] as [
            string,
            string
        ]), ...data.collections.map(c => ["/collections/" + c.slug, c.name + (c.published ? "" : " (hidden)")] as [
            string,
            string
        ]), ...data.collections.flatMap(c => c.products.map(p => ["/products/" + p.slug, c.name + " / " + p.name] as [
            string,
            string
        ]))];
    if (panel)
        return <><Back label="All panels" onClick={() => setSelected("")}/><div className="s-card"><h2>{panel.label}</h2><div className="s-two"><Text label="Panel name (in editor)" value={panel.label} onChange={v => edit({ ...panel, label: v })}/><Choice label="Panel layout" value={panel.type} options={panelTypes} onChange={v => edit({ ...panel, type: v as Panel["type"] })}/></div><Check label="Show this panel" value={panel.shown} onChange={v => edit({ ...panel, shown: v })}/><HeightControl value={panel.height} media={panel.media} onChange={v => edit({ ...panel, height: v })}/><Text label="Title" value={panel.title} onChange={v => edit({ ...panel, title: v })}/><Text label="Body / blurb" large value={panel.body} onChange={v => edit({ ...panel, body: v })}/><MediaEditor label="Panel photos & videos" items={panel.media} onChange={v => edit({ ...panel, media: v })}/>{panel.type === "collections" && <section><h3>Collections shown in this panel</h3><p>Select any number of collections. Images are edited inside each collection.</p><div className="s-collection-checks">{data.collections.map(c=><Check key={c.id} label={c.name+(c.published?"":" (hidden on website)")} value={panel.collectionIds === undefined || panel.collectionIds.includes(c.id)} onChange={shown=>{const ids=panel.collectionIds ?? data.collections.map(c=>c.id); edit({...panel,collectionIds:shown ? [...new Set([...ids,c.id])] : ids.filter(id=>id!==c.id)});}}/>)}</div></section>}{panel.type === "instagram" && <ReelLinks panel={panel} onChange={urls => edit({ ...panel, reelUrls: urls })}/>}<div className="s-two"><Text label="Link text" value={panel.linkLabel} onChange={v => edit({ ...panel, linkLabel: v })}/><Choice label="Link destination" value={panel.link} options={links} onChange={v => edit({ ...panel, link: v })}/></div>{panel.type === "instagram" && <p className="s-notice">Connect your account under Instagram in the studio navigation to show the latest reels automatically. While connected, the synced feed takes priority. These uploaded clips and reel links remain saved and appear when Instagram is disconnected.</p>}{panel.type === "contact" && <p className="s-notice">Submissions appear in Enquiries. Custom Bridal forms are automatically marked as custom bridal enquiries. Email notifications are not connected.</p>}<Delete label={panel.label || "panel"} onDelete={() => { onChange(panels.filter(p => p.id !== panel.id)); setSelected(""); }}/></div></>;
    return <><div className="s-list">{panels.map((p, i) => <div className="s-record" key={p.id}><Field label="Order"><Order label={"Order of " + p.label} max={panels.length} value={i + 1} onChange={v => onChange(moveTo(panels, i, v))}/></Field><button className="s-title-link" onClick={() => setSelected(p.id)}><strong>{p.label || "Untitled panel"}</strong><small>{panelTypes.find(t => t[0] === p.type)?.[1]} · Edit content →</small></button><Check label="Show" value={p.shown} onChange={v => edit({ ...p, shown: v })}/><Delete label={p.label || "panel"} onDelete={() => onChange(panels.filter(item => item.id !== p.id))}/></div>)}</div><div className="s-add-row"><Choice label="New panel layout" value={newType} onChange={v => setNewType(v as Panel["type"])} options={panelTypes}/><button className="s-add" onClick={() => { const p = newPanel(newType, panelTypes.find(t => t[0] === newType)![1]); onChange([...panels, p]); setSelected(p.id); }}><Plus size={17}/>Add panel</button></div></>;
}
function MediaEditor({ label, items, onChange }: {
    label: string;
    items: Media[];
    onChange: (v: Media[]) => void;
}) {
    const setGlobalBusy = useContext(UploadContext), [busy, setBusy] = useState(false), [progress, setProgress] = useState(""), [error, setError] = useState("");
    async function upload(files: File[] | null) {
        if (!files?.length)
            return;
        setBusy(true);
        setGlobalBusy(true);
        setError("");
        const next = [...items];
        const failures: string[] = [];
        try {
            for (let i = 0; i < files.length; i++) {
                setProgress("Uploading " + (i + 1) + " of " + files.length + ": " + files[i].name);
                try {
                    const v = await uploadMedia(files[i], percent => setProgress("Uploading " + (i + 1) + " of " + files.length + ": " + files[i].name + " — " + percent + "%"));
                    next.push({ id: crypto.randomUUID(), url: v.url, type: v.type, alt: "" });
                }
                catch (e) {
                    failures.push(files[i].name + ": " + (e as Error).message);
                }
            }
            onChange(next);
            if (failures.length)
                setError(failures.join("\n"));
            setProgress(failures.length ? "Some files could not be uploaded. Successful uploads were kept." : files.length + " files uploaded. Save your draft to keep these changes.");
        }
        finally {
            setBusy(false);
            setGlobalBusy(false);
        }
    }
    return <section className="s-media-editor"><h3>{label}</h3><p>Photos up to 100 MB; videos up to 500 MB each. Use MP4 or WebM for broad browser support. Hide files to keep them saved without displaying them. Photos default to 5 seconds; videos default to playing in full.</p><label className="s-upload"><Upload size={18}/>{busy ? "Uploading…" : "Upload photos / videos"}<input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" disabled={busy} onChange={e => { upload(e.target.files ? Array.from(e.target.files) : null); e.target.value = ""; }}/></label>{progress && <p role="status">{progress}</p>}{error && <p className="s-error" role="alert">{error}</p>}<div className="s-media-grid">{items.map((m, i) => <div className="s-media-item" key={m.id}><div className="s-media-preview"><Asset item={m} controls/></div><MediaQuality item={m}/><Check label="Show" value={m.shown !== false} onChange={v => onChange(items.map(item => item.id === m.id ? { ...m, shown: v } : item))}/><Field label="Display for" hint={m.type === "video" ? "Leave blank to play the entire video. Enter seconds to advance earlier." : "Seconds before showing the next picture."}><input type="number" min="0.1" step="0.1" max="86400" placeholder={m.type === "video" ? "Until video ends" : "5"} value={m.seconds ?? (m.type === "image" ? 5 : "")} onChange={e => onChange(items.map(item => item.id === m.id ? { ...m, seconds: e.target.value === "" ? null : Number(e.target.value) } : item))}/></Field><Text label="Image description / video label" value={m.alt} onChange={v => onChange(items.map(item => item.id === m.id ? { ...m, alt: v } : item))}/><div className="s-media-actions"><Field label="Order"><Order label={"Order of media " + (i + 1)} max={items.length} value={i + 1} onChange={v => onChange(moveTo(items, i, v))}/></Field><Delete label={"media " + (i + 1)} detail="Remove this file from this panel or product? The uploaded file is retained so other uses are unaffected." onDelete={() => onChange(items.filter(item => item.id !== m.id))}/></div></div>)}</div></section>;
}
function CollectionEditor({ collection: c, onChange, onBack, onDelete }: {
    collection: Collection;
    onChange: (c: Collection) => void;
    onBack: () => void;
    onDelete: () => void;
}) {
    const [selected, setSelected] = useState("");
    const product = c.products.find(p => p.id === selected);
    if (product)
        return <><Back label={"Back to " + c.name} onClick={() => setSelected("")}/><Heading title={product.name}/><ProductEditor product={product} onChange={p => onChange({ ...c, products: c.products.map(item => item.id === p.id ? p : item) })} onDelete={() => { onChange({ ...c, products: c.products.filter(p => p.id !== product.id) }); setSelected(""); }}/></>;
    return <><Back label="All collections" onClick={onBack}/><Heading title={c.name}/><div className="s-card"><div className="s-two"><Text label="Collection title" value={c.name} onChange={v => onChange({ ...c, name: v })}/><Text label="Collection URL slug" value={c.slug} onChange={v => onChange({ ...c, slug: slugify(v) })}/></div><Text large label="Description" value={c.description} onChange={v => onChange({ ...c, description: v })}/><Check label="Show collection on website and in header" value={c.published} onChange={v => onChange({ ...c, published: v })}/><Check label="Show collection hero panel" value={c.heroShown !== false} onChange={v => onChange({ ...c, heroShown: v })}/><section className="s-price-controls"><h3>Pricing for this entire collection</h3><p>Select either option, both, or neither. These controls override individual product display preferences.</p><Check label="Show prices" value={c.showPrices === true} onChange={v=>onChange({...c,showPrices:v})}/><Check label="Show price on request button" value={c.showPriceRequest === true} onChange={v=>onChange({...c,showPriceRequest:v})}/></section><HeightControl label="Collection hero height" value={c.heroHeight} media={c.hero} onChange={v => onChange({ ...c, heroHeight: v })}/><MediaEditor label="Collection hero photos & videos" items={c.hero} onChange={v => onChange({ ...c, hero: v })}/><MediaEditor label="Home-page display media" items={c.cover} onChange={v => onChange({ ...c, cover: v })}/></div><div className="s-heading"><h2>Products in {c.name}</h2><p>Each gown belongs to this collection. Open a product to edit its gallery, price and description.</p></div><div className="s-list">{c.products.map((p, i) => <div className="s-record" key={p.id}><div className="s-thumb">{p.media[0] && <Asset item={p.media[0]}/>}</div><button className="s-title-link" onClick={() => setSelected(p.id)}><strong>{p.name}</strong><small>{p.published ? "Shown" : "Hidden"} · {c.showPrices ? "Collection prices shown" : c.showPriceRequest ? "Price on request" : "Pricing hidden"}</small></button><Field label="Order"><Order label={"Order of " + p.name} max={c.products.length} value={i + 1} onChange={v => onChange({ ...c, products: moveTo(c.products, i, v) })}/></Field></div>)}</div><button className="s-add" onClick={() => { const id = crypto.randomUUID(); onChange({ ...c, products: [...c.products, { id, slug: "new-gown-" + id.slice(0, 8), name: "New gown", description: "", price: null, showPrice: false, published: false, media: [] }] }); setSelected(id); }}><Plus size={17}/>Add product</button><div className="s-danger"><Delete label={c.name} detail={"This deletes the collection and its " + c.products.length + " products from your draft. The live site is unchanged until you publish."} onDelete={onDelete}/></div></>;
}
function ProductEditor({ product: p, onChange, onDelete }: {
    product: Product;
    onChange: (p: Product) => void;
    onDelete: () => void;
}) {
    return <div className="s-card"><div className="s-two"><Text label="Product name" value={p.name} onChange={v => onChange({ ...p, name: v })}/><Text label="Product URL slug" value={p.slug} onChange={v => onChange({ ...p, slug: slugify(v) })}/></div><Text label="Description" large value={p.description} onChange={v => onChange({ ...p, description: v })}/><div className="s-two"><Field label="Internal price (AUD)" hint="Saved privately even when customers see price on request. Used to find similarly priced gowns."><input type="number" min={0} step="0.01" value={p.price ?? ""} onChange={e => onChange({ ...p, price: e.target.value === "" ? null : Number(e.target.value) })}/></Field><p>Customer pricing is controlled for the whole collection. Edit “Show prices” and “Show price on request button” in collection settings.</p></div><Check label="Show product on website" value={p.published} onChange={v => onChange({ ...p, published: v })}/><MediaEditor label="Product gallery — photos & videos" items={p.media} onChange={v => onChange({ ...p, media: v })}/><a href={"/products/" + p.slug + "?preview=1"} target="_blank" rel="noreferrer">Preview saved gallery</a><div className="s-danger"><Delete label={p.name} onDelete={onDelete}/></div></div>;
}
