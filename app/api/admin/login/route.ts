import { createAdminSession, getAdminPasscode } from "../../../../lib/admin-auth";
import {requestAllowed} from "@/lib/request-limit";
export async function POST(request: Request) {
 const headers={"Cache-Control":"private, no-store"};
 if(request.headers.get("origin") && request.headers.get("origin")!==new URL(request.url).origin)
  return Response.json({error:"Invalid origin."},{status:403,headers});
 try {
  const expected=getAdminPasscode();
  if(!await requestAllowed(request,"login",10,900))
   return Response.json({error:"Too many login attempts. Please try again in 15 minutes."},{status:429,headers:{...headers,"Retry-After":"900"}});
  const raw=await request.text();
  if(raw.length>2048)return Response.json({error:"Invalid login request."},{status:400,headers});
  let payload;
  try {payload=JSON.parse(raw);} catch {return Response.json({error:"Enter your admin password."},{status:400,headers});}
  if(!payload || typeof payload.passcode!=="string" || payload.passcode!==expected)
   return Response.json({error:"That password is not correct."},{status:401,headers});
  return Response.json({ok:true},{headers:{...headers,"Set-Cookie":await createAdminSession(request)}});
 }catch{
  return Response.json({error:"Admin login is temporarily unavailable. Please retry."},{status:503,headers});
 }
}
