"use client";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext, type CarouselApi } from "@/components/ui/carousel";
import type { Product } from "@/lib/studio-model";
export default function GownViewer({ product, close }: { product: Product | null; close: () => void }) {
  return <Dialog open={!!product} onOpenChange={open => {if (!open) close();}}><DialogContent className="b-gown-viewer">{product && <Slides key={product.id} product={product}/>}</DialogContent></Dialog>;
}
function Slides({product}: {product:Product}) {
  const [api,setApi] = useState<CarouselApi>(), [index,setIndex] = useState(0);
  const media=product.media.filter(m => m.shown !== false);
  useEffect(() => {if(!api)return; const update=()=>setIndex(api.selectedScrollSnap()); update(); api.on("select",update); return ()=>{api.off("select",update);};},[api]);
  return <><div className="b-viewer-heading"><DialogTitle>{product.name}</DialogTitle><span aria-live="polite">{media.length ? index+1 : 0} / {media.length}</span></div><DialogDescription className="sr-only">Swipe or use the previous and next buttons to view this gown's images. Press Escape to close.</DialogDescription>{media.length ? <Carousel setApi={setApi} opts={{loop:media.length>1}} className="b-viewer-carousel"><CarouselContent>{media.map((m,i)=><CarouselItem key={m.id}><div className="b-viewer-slide">{m.type==="image" ? <img src={m.url} alt={m.alt || product.name + " — image " + (i+1)} loading={i===0?"eager":"lazy"}/> : i===index ? <video src={m.url} controls playsInline preload="metadata"/> : <div>Video</div>}</div></CarouselItem>)}</CarouselContent>{media.length>1 && <><CarouselPrevious className="b-viewer-prev"/><CarouselNext className="b-viewer-next"/></>}</Carousel> : <p>No images have been added for this gown yet.</p>}</>;
}
