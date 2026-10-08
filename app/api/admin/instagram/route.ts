import { isAdminRequest } from "@/lib/admin-auth";
import { beginInstagram, configureInstagram, disconnectInstagram, instagramStatus, syncInstagram } from "@/lib/instagram";
import { isSameOriginRequest } from "@/lib/request-origin";
export const dynamic = "force-dynamic";
const headers = {"Cache-Control":"private, no-store"};
export async function GET(request: Request) {
  if (!await isAdminRequest(request)) return Response.json({error:"Studio access required."}, {status:401, headers});
  try { return Response.json(await instagramStatus(), {headers}); }
  catch { return Response.json({error:"Unable to load Instagram settings. Please retry."}, {status:503, headers}); }
}
export async function POST(request: Request) {
  if (!await isAdminRequest(request)) return Response.json({error:"Studio access required."}, {status:401, headers});
  if (!isSameOriginRequest(request)) return Response.json({error:"Invalid origin."}, {status:403, headers});
  try {
    const input = await request.text();
    if (input.length > 4096) return Response.json({error:"Request too large."}, {status:413, headers});
    const body = JSON.parse(input);
    if (body.action === "configure") await configureInstagram(String(body.appId || "").trim(), String(body.secret || "").trim());
    else if (body.action === "connect") {
      const {url,state} = await beginInstagram();
      return Response.json({url}, {headers:{...headers, "Set-Cookie":`julie_instagram_state=${state}; Max-Age=600; Path=/api/admin/instagram; HttpOnly; Secure; SameSite=Lax`}});
    }
    else if (body.action === "sync") await syncInstagram(true);
    else if (body.action === "disconnect") await disconnectInstagram();
    else return Response.json({error:"Unknown action."}, {status:400, headers});
    return Response.json(await instagramStatus(), {headers});
  } catch (e) {
    // Only our own actionable errors are returned, never upstream credential-bearing payloads.
    const message = e instanceof Error && !["SyntaxError","TypeError"].includes(e.name) ? e.message : "Instagram settings could not be saved. Please retry.";
    return Response.json({error:message}, {status:400, headers});
  }
}
