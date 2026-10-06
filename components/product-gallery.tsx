"use client";
import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import type { Media } from "@/lib/studio-model";
export default function ProductGallery({ items }: {
    items: Media[];
}) {
    const shown = items.filter(m => m.shown !== false), root = useRef<HTMLDivElement>(null), [index, setIndex] = useState(0);
    const step = useRef(600);
    useEffect(() => {
        const update = () => { if (!root.current)
            return; step.current = root.current.querySelector<HTMLElement>(".b-gallery-main")?.clientHeight || Math.min(window.innerHeight * .76, 820); const offset = 20 - root.current.getBoundingClientRect().top; setIndex(Math.max(0, Math.min(shown.length - 1, Math.floor((offset + step.current * .15) / step.current)))); };
        update();
        window.addEventListener("scroll", update, { passive: true });
        window.addEventListener("resize", update);
        return () => { window.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
    }, [shown.length]);
    if (!shown.length)
        return <div className="b-gallery-empty">Images coming soon.</div>;
    const active = shown[Math.max(0, Math.min(index, shown.length - 1))];
    function choose(i: number) { if (!root.current)
        return; const top = window.scrollY + root.current.getBoundingClientRect().top - 20 + i * step.current; window.scrollTo({ top, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" }); }
    return <div ref={root} className="b-gallery-scroll" style={{ height: shown.length > 1 ? `calc(${shown.length} * min(76svh, 820px))` : "auto" }}><div className="b-gallery-sticky"><div className="b-gallery-main" aria-live="polite">{active.type === "video" ? <video key={active.id} src={active.url} controls playsInline preload="metadata" aria-label={active.alt || "Product video"}/> : <img key={active.id} src={active.url} alt={active.alt || "Gown view " + (index + 1)}/>}<span className="b-gallery-count">{index + 1} / {shown.length}</span></div><div className="b-gallery-thumbnails" aria-label="Product images and videos">{shown.map((m, i) => <button key={m.id} onClick={() => choose(i)} className={index === i ? "active" : ""} aria-label={"View " + (m.type === "video" ? "video" : "image") + " " + (i + 1)} aria-pressed={index === i}>{m.type === "video" ? <><video src={m.url + "#t=0.1"} muted playsInline preload="metadata"/><Play size={18}/></> : <img src={m.url} alt="" loading="lazy"/>}</button>)}</div>{shown.length > 1 && <p className="b-gallery-hint">Scroll to see the next view, or choose a thumbnail.</p>}</div></div>;
}
