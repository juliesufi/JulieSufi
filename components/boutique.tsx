"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ChevronDown, Menu, X, ArrowUpRight } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { footerPages, navPages, type Collection, type Media, type Panel, type Product, type StudioData } from "@/lib/studio-model";
import Studio from "./studio";
import GownViewer from "./gown-viewer";
import ReelWall from "./reel-wall";
export function panelStyle(height?: number): CSSProperties | undefined { return height === undefined ? undefined : { "--panel-vh": (30 + height * .8) + "svh", "--panel-space": (20 + height * 1.4) + "px" } as CSSProperties; }
export async function api<T = Record<string, unknown>>(url: string, options?: RequestInit): Promise<T> {
    const r = await fetch(url, { cache: "no-store", ...options });
    const body = await r.json() as {
        error?: string;
    };
    if (!r.ok)
        throw new Error(body.error || "Please try again.");
    return body as T;
}
export function Asset({ item, controls = false }: {
    item: Media;
    controls?: boolean;
}) { return item.type === "video" ? <video src={item.url} playsInline controls={controls} autoPlay={!controls} muted={!controls} loop={!controls} preload="metadata" aria-label={item.alt || "Bridal film"}/> : <img src={item.url} alt={item.alt || "Julie Sufi bridal couture"} loading="lazy"/>; }
export function MediaShow({ items, className = "", href }: {
    items: Media[];
    className?: string;
    href?: string;
}) {
    const visible = items.filter(m => m.shown !== false);
    const [index, setIndex] = useState(0), [loaded, setLoaded] = useState("");
    const advanced = useRef("");
    const current = visible[index % Math.max(visible.length, 1)];
    function next() { if (!current || visible.length < 2 || advanced.current === current.id)
        return; advanced.current = current.id; setLoaded(""); setIndex(i => (i + 1) % visible.length); }
    useEffect(() => { setIndex(0); }, [items]);
    useEffect(() => { if (!current || current.type !== "image" || visible.length < 2 || loaded !== current.id)
        return; const timer = setTimeout(next, (current.seconds ?? 5) * 1000); return () => clearTimeout(timer); }, [current?.id, current?.seconds, loaded, visible.length]);
    if (!current)
        return null;
    const asset = current.type === "video" ? <video key={current.id} src={current.url} playsInline autoPlay muted loop={visible.length === 1} preload="metadata" onEnded={next} onTimeUpdate={e => { if (current.seconds && visible.length > 1 && e.currentTarget.currentTime >= current.seconds)
        next(); }} onClick={e => { if (e.currentTarget.paused)
        e.currentTarget.play().catch(() => { }); }} aria-label={current.alt || "Bridal film"}/> : <img key={current.id} src={current.url} alt={current.alt || "Julie Sufi bridal couture"} onLoad={() => setLoaded(current.id)} onError={() => setLoaded(current.id)}/>;
    return <div className={"b-media " + className}>{href ? <a href={href}>{asset}</a> : asset}</div>;
}
export default function Boutique() {
    const [access, setAccess] = useState<"checking" | "locked" | "open">("checking"), [data, setData] = useState<StudioData | null>(null), [error, setError] = useState(""), [path, setPath] = useState("/"), [preview, setPreview] = useState(false);
    useEffect(() => {
        setPath(window.location.pathname);
        setPreview(new URLSearchParams(window.location.search).get("preview") === "1");
        if (!window.location.pathname.startsWith("/admin") && new URLSearchParams(window.location.search).get("preview") !== "1") {
            setAccess("open");
            return;
        }
        api<{
            unlocked: boolean;
        }>("/api/site-access").then(v => setAccess(v.unlocked ? "open" : "locked")).catch(e => { setAccess("locked"); setError(e.message); });
    }, []);
    useEffect(() => {
        if (access !== "open" || path.startsWith("/admin"))
            return;
        api<StudioData>("/api/storefront" + (preview ? "?preview=1" : "")).then(setData).catch(e => setError(e.message));
    }, [access, path, preview]);
    if (access === "locked")
        return <AccessGate error={error} onOpen={() => { setError(""); setAccess("open"); }}/>;
    if (access === "checking" || (!path.startsWith("/admin") && !data))
        return <div className="loading-shell"><div className="loading-mark">JS</div><p role="status">{error || "Opening the atelier…"}</p>{error && <button onClick={() => location.reload()}>Retry</button>}</div>;
    if (path.startsWith("/admin"))
        return <Studio />;
    return <Storefront data={data!} path={path} preview={preview}/>;
}
function AccessGate({ onOpen, error }: {
    onOpen: () => void;
    error: string;
}) {
    const [code, setCode] = useState(""), [message, setMessage] = useState(error), [busy, setBusy] = useState(false);
    return <div className="site-access"><div className="site-access__panel"><div className="site-access__mark">JS</div><h1>Admin login.</h1><p>Enter your admin password to manage Julie Sufi.</p><form onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
                await api("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ passcode: code }) });
                onOpen();
            }
            catch (e) {
                setMessage((e as Error).message);
            }
            finally {
                setBusy(false);
            }
        }}><label htmlFor="access-code">Admin password</label><input id="access-code" type="password" autoComplete="current-password" value={code} onChange={e => setCode(e.target.value)} required/><p role="alert">{message}</p><button className="b-button" disabled={busy}>{busy ? "Verifying…" : "Sign in to admin"}</button></form><a className="b-link" href="/">Return to website</a></div></div>;
}
function Header({ data }: {
    data: StudioData;
}) {
    const [mobile, setMobile] = useState(false), [collectionsOpen, setCollectionsOpen] = useState(false), ref = useRef<HTMLElement>(null);
    useEffect(() => {
        const close = (e: PointerEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node))
                { setMobile(false); setCollectionsOpen(false); }
        };
        const key = (e: KeyboardEvent) => {
            if (e.key === "Escape")
                setMobile(false);
        };
        document.addEventListener("pointerdown", close);
        document.addEventListener("keydown", key);
        return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", key); };
    }, []);
    return <><div className="b-announcement">{data.settings.announcement}</div><header className="b-header" ref={ref} style={data.settings.headerHeight === undefined ? undefined : { paddingBlock: 10 + data.settings.headerHeight * .5 }}><a href="/" className="b-logo">{data.settings.logo?.url ? <img src={data.settings.logo.url} alt={data.settings.brandName}/> : <>{data.settings.brandName}<small>Bridal couture</small></>}</a><button className="b-menu-toggle" aria-label="Toggle navigation" aria-expanded={mobile} onClick={() => {setMobile(!mobile); setCollectionsOpen(false);}}>{mobile ? <X /> : <Menu />}</button><nav className={mobile ? "is-open" : ""} aria-label="Main navigation"><div className="b-desktop-collections"><DropdownMenu modal={false}><DropdownMenuTrigger className="b-nav-trigger">Collections <ChevronDown size={15}/></DropdownMenuTrigger><DropdownMenuContent className="b-dropdown" align="start">{data.collections.map(c => <DropdownMenuItem key={c.id} asChild><a href={"/collections/" + c.slug}>{c.name}</a></DropdownMenuItem>)}<DropdownMenuItem asChild><a href="/collections">All collections</a></DropdownMenuItem></DropdownMenuContent></DropdownMenu></div><div className="b-mobile-collections"><button className="b-nav-trigger" aria-expanded={collectionsOpen} aria-controls="mobile-collections" onClick={() => setCollectionsOpen(v => !v)}>Collections <ChevronDown size={16}/></button>{collectionsOpen && <div id="mobile-collections">{data.collections.map(c => <a key={c.id} href={"/collections/" + c.slug} onClick={() => {setMobile(false); setCollectionsOpen(false);}}>{c.name}</a>)}<a href="/collections" onClick={() => {setMobile(false); setCollectionsOpen(false);}}>All collections</a></div>}</div>{navPages.filter(([slug]) => data.pages.some(p => p.slug === slug)).map(([slug, label]) => <a key={slug} href={"/pages/" + slug}>{label}</a>)}</nav></header></>;
}
function Footer({ data }: {
    data: StudioData;
}) { return <footer className="store-footer b-footer" style={{"--footer-space": (12 + (data.settings.footerHeight ?? 35) * 2.4) + "px"} as CSSProperties}><div className="store-footer__brand"><span className="footer-monogram">JS</span><p>{data.settings.footerNote}</p></div><div className="store-footer__links"><div><p className="eyebrow eyebrow--light">Explore</p>{navPages.filter(([slug]) => data.pages.some(p => p.slug === slug)).map(([slug, label]) => <a key={slug} href={"/pages/" + slug}>{label}</a>)}</div><div><p className="eyebrow eyebrow--light">Information</p>{footerPages.filter(([slug]) => data.pages.some(p => p.slug === slug)).map(([slug, label]) => <a key={slug} href={"/pages/" + slug}>{label}</a>)}</div><div><p className="eyebrow eyebrow--light">Connect</p><a href={"mailto:" + data.settings.contactEmail}>Email</a>{data.settings.contactPhone && <a href={"tel:" + data.settings.contactPhone.replace(/[^+0-9]/g, "")}>{data.settings.contactPhone}</a>}<a href="https://www.instagram.com/juliesufi/" target="_blank" rel="noreferrer">Instagram</a><a href="/admin">Admin</a></div></div><div className="store-footer__bottom"><span>© {new Date().getFullYear()} {data.settings.brandName}</span><span>{data.settings.studioLocation}</span><span>Private appointments by enquiry</span></div></footer>; }
function PanelLink({ panel }: {
    panel: Panel;
}) { return panel.link && panel.linkLabel ? <a className="b-link" href={panel.link}>{panel.linkLabel}<ArrowUpRight size={17}/></a> : null; }
export function PanelView({ panel: p, data, context = "" }: {
    panel: Panel;
    data: StudioData;
    context?: string;
}) {
    if (!p.shown)
        return null;
    const copy = <div className="b-panel-copy">{p.title && <h2>{p.title}</h2>}{p.body && <p className="b-prose">{p.body}</p>}<PanelLink panel={p}/></div>;
    if (p.type === "collections")
        return <section className="b-section b-sized" style={panelStyle(p.height)}>{copy}{p.media.length > 0 && <MediaShow items={p.media}/>}<div className="b-collections">{data.collections.filter(c => p.collectionIds === undefined || p.collectionIds.includes(c.id)).map(c => <article className="b-collection" key={c.id}><MediaShow items={c.cover.length ? c.cover : c.hero} href={"/collections/" + c.slug}/><a href={"/collections/" + c.slug}><h3>{c.name}</h3><span>Discover the collection</span></a></article>)}</div><a className="b-link b-all-collections-link" href="/collections">Show all collections</a></section>;
    if (p.type === "contact")
        return <section className="b-section b-contact b-sized" style={panelStyle(p.height)}>{p.media.length > 0 && <MediaShow items={p.media}/>}<div>{copy}<Enquiry kind={context === "custom-bridal" ? "Custom bridal enquiry" : p.title || "General enquiry"} email={data.settings.contactEmail}/></div></section>;
    if (p.type === "instagram")
        return <section className="b-social b-sized" style={panelStyle(p.height)}>{copy}<ReelWall panel={p}/></section>;
    return <section style={panelStyle(p.height)} className={"b-panel b-" + p.type + (p.media.length ? "" : " b-no-media") + (p.type === "split" ? " b-editorial" : "")}><MediaShow items={p.media}/>{copy}</section>;
}
function Storefront({ data, path, preview }: {
    data: StudioData;
    path: string;
    preview: boolean;
}) {
    const slug = decodeURIComponent(path.split("/")[2] || "");
    const collection = path.startsWith("/collections/") ? data.collections.find(c => c.slug === slug) : undefined;
    const page = path.startsWith("/pages/") ? data.pages.find(p => p.slug === slug) : undefined;
    const product = path.startsWith("/products/") ? data.collections.flatMap(c => c.products).find(p => p.slug === slug) : undefined;
    const [viewing,setViewing] = useState<Product | null>(null), [enquiryProduct,setEnquiryProduct] = useState<Product | null>(null);
    useEffect(() => { if(product) {const owner=data.collections.find(c=>c.products.some(p=>p.id===product.id)); if(owner) location.replace("/collections/"+owner.slug+"?gown="+product.slug+(preview?"&preview=1":""));} else if(collection) {const gown=new URLSearchParams(location.search).get("gown"); setViewing(collection.products.find(p=>p.slug===gown)||null);} },[path,data]);
    return <div className="boutique" onClick={e => {
            if (!preview)
                return;
            const anchor = (e.target as HTMLElement).closest("a");
            if (anchor && anchor.getAttribute("href")?.startsWith("/") && !anchor.getAttribute("href")?.startsWith("/admin")) {
                const u = new URL(anchor.href);
                u.searchParams.set("preview", "1");
                anchor.href = u.href;
            }
        }}>{preview && <div className="b-preview">Saved draft preview · Only published pages and collections are shown <a href="/admin">Back to editor</a></div>}<Header data={data}/><main id="main-content">{path === "/" ? data.home.map(p => <PanelView key={p.id} panel={p} data={data}/>) : path.replace(/\/$/, "") === "/collections" ? <><div className="b-collection-heading"><h1>All collections</h1></div>{data.collections.map(c => <section className="b-section b-catalogue b-collection-group" key={c.id}><h2 className="b-sticky-collection"><a href={"/collections/"+c.slug}>{c.name}</a></h2>{c.description && <p className="b-prose b-collection-description">{c.description}</p>}<Catalogue collection={c} onView={setViewing} onEnquire={setEnquiryProduct}/></section>)}{!data.collections.length && <p className="b-section">New collections will be revealed soon.</p>}</> : collection ? <>{collection.heroShown !== false ? <section style={panelStyle(collection.heroHeight)} className="b-panel b-hero"><MediaShow items={collection.hero}/><div className="b-panel-copy"><p>THE COLLECTION</p><h1>{collection.name}</h1><p>{collection.description}</p></div></section> : <div className="b-collection-heading"><h1>{collection.name}</h1><p>{collection.description}</p></div>}<section className="b-section b-catalogue"><Catalogue collection={collection} onView={setViewing} onEnquire={setEnquiryProduct}/></section></> : page ? page.panels.map(p => <PanelView key={p.id} panel={p} data={data} context={page.slug}/>) : product ? <p className="b-section">Opening collection…</p> : <section className="b-section"><h1>Page not found</h1><a className="b-link" href="/">Return to the home page</a></section>}</main><GownViewer product={viewing} close={()=>setViewing(null)}/><Dialog open={!!enquiryProduct} onOpenChange={open=>{if(!open)setEnquiryProduct(null);}}><DialogContent className="b-dialog"><DialogTitle>Enquire about {enquiryProduct?.name}</DialogTitle><DialogDescription>Tell us how we can help with this gown.</DialogDescription>{enquiryProduct && <Enquiry kind={"Product enquiry: "+enquiryProduct.name} productPath={"/collections/"+data.collections.find(c=>c.products.some(p=>p.id===enquiryProduct.id))?.slug+"?gown="+enquiryProduct.slug} email={data.settings.contactEmail}/>}</DialogContent></Dialog><Footer data={data}/></div>;
}
function Catalogue({collection, onView, onEnquire}: {collection: Collection; onView: (p: Product) => void; onEnquire: (p: Product) => void}) {
    return <><div className="b-products">{collection.products.map(p => <article className="b-catalogue-card" key={p.id}><button className="b-product-card" onClick={()=>onView(p)} aria-label={"View images of "+p.name}>{p.media[0] && <div className="b-card-image"><Asset item={p.media[0]}/></div>}<h3>{p.name}</h3></button>{collection.showPrices && p.price !== null && <p>{money(p.price)}</p>}{collection.showPriceRequest && <button className="b-link" onClick={()=>onEnquire(p)}>Price on request</button>}</article>)}</div>{!collection.products.length && <p>New pieces will be revealed soon.</p>}</>;
}
function money(value: number) { return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(value); }
function Enquiry({ kind, productPath = "", email }: {
    kind: string;
    productPath?: string;
    email: string;
}) {
    const [busy, setBusy] = useState(false), [sent, setSent] = useState(false), [error, setError] = useState(""), [productUrl, setProductUrl] = useState("");
    useEffect(() => {
        if (productPath)
            setProductUrl(new URL(productPath, window.location.origin).href);
    }, [productPath]);
    if (sent)
        return <div className="b-form-success" role="status"><h3>Thank you.</h3><p>Your enquiry has been received by the studio.</p><button className="b-link" onClick={() => setSent(false)}>Send another enquiry</button></div>;
    return <form className="b-enquiry" onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setBusy(true);
            setError("");
            try {
                await api("/api/enquiries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: f.get("name"), email: f.get("email"), phone: f.get("phone"), message: f.get("message"), website: f.get("website"), kind, productUrl }) });
                setSent(true);
            }
            catch (e) {
                setError((e as Error).message);
            }
            finally {
                setBusy(false);
            }
        }}><div className="b-form-row"><label>Your name<input name="name" required maxLength={200} autoComplete="name"/></label><label>Email address<input name="email" type="email" required maxLength={300} autoComplete="email"/></label></div><label>Phone<input name="phone" required type="tel" maxLength={100} autoComplete="tel"/></label>{productUrl && <label>Gown link<input value={productUrl} readOnly/></label>}<label>Your enquiry<textarea name="message" required rows={5} maxLength={10000}/></label><label className="b-honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off"/></label><p className="b-form-note">Your details will be used to respond to this enquiry. <a href="/pages/privacy-policy">Privacy Policy</a></p>{error && <p role="alert" className="b-error">{error} <a href={"mailto:" + email}>Email the studio</a></p>}<button className="b-button" disabled={busy}>{busy ? "Sending…" : "Send enquiry"}</button></form>;
}
