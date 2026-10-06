"use client";
import {useEffect,useState} from "react";
import type {Media} from "@/lib/studio-model";
export default function MediaQuality({item}:{item:Media}){
 const [size,setSize]=useState<{width:number;height:number}|null>(null),[failed,setFailed]=useState(false);
 useEffect(()=>{
  setSize(null);setFailed(false);if(item.type!=="image")return;
  const image=new Image();let active=true;
  image.onload=()=>{if(active)setSize({width:image.naturalWidth,height:image.naturalHeight});};
  image.onerror=()=>{if(active)setFailed(true);};image.src=item.url;
  return()=>{active=false;image.onload=null;image.onerror=null;};
 },[item.url,item.type]);
 if(item.type!=="image")return null;
 if(failed)return <p className="s-quality s-quality-warning">Image could not be checked. Check the file before publishing.</p>;
 if(!size)return <p className="s-quality">Checking image resolution…</p>;
 const small=size.width<1600||size.height<1600;
 return <p className={"s-quality"+(small?" s-quality-warning":"")}>{size.width} × {size.height} pixels · Original file{small?<><br/>May look soft on large or high-density screens. Upload a sharper original, ideally at least 2400 pixels on the longest edge. File size alone does not determine sharpness.</>:<><br/>Resolution checked; review focus and sharpness in the saved gallery preview.</>}</p>;
}
