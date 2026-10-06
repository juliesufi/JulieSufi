"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { InstagramReel } from "@/lib/instagram";
import type { Panel } from "@/lib/studio-model";
export default function ReelWall({ panel }: {
    panel: Panel;
}) {
    const row = useRef<HTMLDivElement>(null), [selected, setSelected] = useState<number | null>(null);
    const [feed, setFeed] = useState<{connected:boolean; reels:InstagramReel[]} | null>(null);
    useEffect(() => {
        let cancelled = false;
        const update = () => fetch("/api/instagram", {cache:"no-store"}).then(async r => {if (!r.ok) return; const data = await r.json() as {connected:boolean; reels:InstagramReel[]}; if (!cancelled) setFeed(data);}).catch(() => {});
        update(); const timer = setInterval(update, 15 * 60000);
        return () => {cancelled = true; clearInterval(timer);};
    }, []);
    const media = feed?.connected ? feed.reels.map(r => ({id:r.id, url:r.url || r.poster, type:r.url ? "video" as const : "image" as const, alt:r.caption, poster:r.poster, link:r.link})) : panel.media.filter(m => m.shown !== false).map(m => ({...m, poster:"", link:""}));
    const urls = feed?.connected ? [] : panel.reelUrls ?? (panel.reelUrl ? [panel.reelUrl] : []);
    const active = selected === null ? null : media[selected];
    return <div className="b-reel-wall"><div className="b-reel-track" ref={row}>{media.map((m, i) => <button className="b-reel-tile" key={m.id} onClick={() => setSelected(i)} aria-label={"Open reel " + (i + 1)}>{m.type === "video" ? <video src={m.url} poster={m.poster || undefined} playsInline muted loop autoPlay preload="metadata"/> : <img src={m.url} alt={m.alt || "Julie Sufi reel " + (i + 1)}/>}<Play className="b-reel-play" size={22}/></button>)}{urls.map((url, i) => <div className="b-reel-tile b-reel-embed" key={url + i}><iframe title={"Julie Sufi Instagram reel " + (i + 1)} src={url.replace(/\/$/, "") + "/embed/"} loading="lazy" allow="encrypted-media; fullscreen" referrerPolicy="strict-origin-when-cross-origin"/><a href={url} target="_blank" rel="noreferrer">View reel on Instagram</a></div>)}</div>{media.length + urls.length > 1 && <div className="b-reel-nav"><button aria-label="Previous reels" onClick={() => row.current?.scrollBy({ left: -row.current.clientWidth * .8, behavior: "smooth" })}><ChevronLeft /></button><button aria-label="Next reels" onClick={() => row.current?.scrollBy({ left: row.current.clientWidth * .8, behavior: "smooth" })}><ChevronRight /></button></div>}<a className="b-link" href="https://www.instagram.com/juliesufi/reels/" target="_blank" rel="noreferrer">@juliesufi</a><Dialog open={!!active} onOpenChange={open => { if (!open)
        setSelected(null); }}><DialogContent className="b-dialog b-reel-dialog"><DialogTitle className="sr-only">Julie Sufi reel</DialogTitle>{active && (active.type === "video" ? <video src={active.url} poster={active.poster || undefined} controls autoPlay playsInline/> : <img src={active.url} alt={active.alt || "Julie Sufi"}/>)}{active?.link && <a className="b-link" href={active.link} target="_blank" rel="noreferrer">View on Instagram</a>}</DialogContent></Dialog></div>;
}
