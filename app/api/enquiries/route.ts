import { isAdminRequest } from "@/lib/admin-auth";
import { getD1 } from "@/lib/site-data";
import { z } from "zod";
import { requestAllowed } from "@/lib/request-limit";
import { isSameOriginRequest } from "@/lib/request-origin";
export const dynamic = "force-dynamic";
const schema = z.object({ name: z.string().trim().min(1).max(200), email: z.string().trim().email().max(300), phone: z.string().trim().min(1).max(100).refine(v => v.replace(/\D/g, "").length >= 6, "Enter a valid phone number"), message: z.string().min(1).max(10000), kind: z.string().max(200), productUrl: z.string().max(2000), website: z.string().max(200).optional() });
export async function POST(request: Request) {
    if (!isSameOriginRequest(request))
        return Response.json({ error: "Invalid origin." }, { status: 403 });
    try {
        if (!await requestAllowed(request,"enquiry",5,600))
            return Response.json({error:"Too many enquiries sent. Please try again in 10 minutes."},{status:429,headers:{"Retry-After":"600","Cache-Control":"no-store"}});
        const input = await request.text();
        if (input.length > 20000)
            return Response.json({ error: "Your message is too long." }, { status: 413 });
        let decoded;
        try { decoded=JSON.parse(input); } catch { return Response.json({error:"Invalid enquiry."},{status:400}); }
        const parsed = schema.safeParse(decoded);
        if (!parsed.success)
            return Response.json({ error: "Please enter your name, a valid email, phone number and a message." }, { status: 400 });
        if (parsed.data.website)
            return Response.json({ ok: true });
        const db = getD1();
        if (!db)
            throw new Error();
        const createdAt = new Date().toISOString(), id = crypto.randomUUID();
        await db.prepare("INSERT INTO site_settings (key,value_json,updated_at) VALUES (?,?,?)").bind("enquiry:" + id, JSON.stringify({ ...parsed.data, id, createdAt }), createdAt).run();
        return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    }
    catch {
        return Response.json({ error: "Your enquiry was not sent. Please retry or email the studio." }, { status: 503 });
    }
}

const noStore = { "Cache-Control": "private, no-store" };
const baseWhere = "key GLOB 'enquiry:*'";
const isActive = "json_extract(value_json, '$.deletedAt') IS NULL";
const isUnread = "json_extract(value_json, '$.readAt') IS NULL";
export async function GET(request: Request) {
    if (!await isAdminRequest(request))
        return Response.json({ error: "Studio access required." }, { status: 401 });
    try {
        const db = getD1();
        if (!db) throw new Error("Missing enquiry storage");
        const params = new URL(request.url).searchParams;
        const summary = await db.prepare(`SELECT COUNT(*) AS unreadCount FROM site_settings WHERE ${baseWhere} AND ${isActive} AND ${isUnread}`).first<{unreadCount:number}>();
        if (params.get("summary") === "1") return Response.json({unreadCount: summary?.unreadCount ?? 0}, {headers:noStore});
        const filter = params.get("filter") || "inbox";
        const clauses = [baseWhere, filter === "trash" ? "json_extract(value_json, '$.deletedAt') IS NOT NULL" : isActive];
        if (filter === "unread") clauses.push(isUnread);
        if (filter === "read") clauses.push("json_extract(value_json, '$.readAt') IS NOT NULL");
        const search = (params.get("search") || "").trim().slice(0,200);
        const bindings: string[] = [];
        if (search) {
            clauses.push("instr(lower(coalesce(json_extract(value_json,'$.name'),'') || ' ' || coalesce(json_extract(value_json,'$.email'),'') || ' ' || coalesce(json_extract(value_json,'$.phone'),'') || ' ' || coalesce(json_extract(value_json,'$.message'),'') || ' ' || coalesce(json_extract(value_json,'$.kind'),'')), lower(?)) > 0");
            bindings.push(search);
        }
        const where = clauses.join(" AND ");
        const sorts: Record<string,string> = {newest:"json_extract(value_json,'$.createdAt') DESC",oldest:"json_extract(value_json,'$.createdAt') ASC",name:"json_extract(value_json,'$.name') COLLATE NOCASE ASC",unread:"(json_extract(value_json,'$.readAt') IS NOT NULL) ASC, json_extract(value_json,'$.createdAt') DESC"};
        const sort = sorts[params.get("sort") || "newest"] || sorts.newest;
        const count = await db.prepare(`SELECT COUNT(*) AS total FROM site_settings WHERE ${where}`).bind(...bindings).first<{total:number}>();
        const total = count?.total ?? 0, pages = Math.max(1,Math.ceil(total/50));
        const requested = Number(params.get("page") || 1);
        const page = Math.min(pages, Number.isSafeInteger(requested) && requested > 0 ? requested : 1);
        const rows = await db.prepare(`SELECT value_json FROM site_settings WHERE ${where} ORDER BY ${sort}, key ASC LIMIT 50 OFFSET ?`).bind(...bindings,(page-1)*50).all<{value_json:string}>();
        return Response.json({items:rows.results.map(r=>JSON.parse(r.value_json)),total,page,pages,unreadCount:summary?.unreadCount??0}, {headers:noStore});
    } catch(error) {
        console.error("Enquiry listing failed", error);
        return Response.json({error:"Enquiries are unavailable. Please retry."}, {status:503,headers:noStore});
    }
}
const updateSchema = z.object({action:z.enum(["read","unread","delete","restore"]),ids:z.array(z.string().uuid()).min(1).max(50)});
export async function PATCH(request: Request) {
    if (!await isAdminRequest(request)) return Response.json({error:"Studio access required."},{status:401});
    if (!isSameOriginRequest(request)) return Response.json({error:"Invalid origin."},{status:403});
    try {
        const raw = await request.text();
        if(raw.length > 10000) return Response.json({error:"Too many enquiries selected."},{status:413});
        let parsed;
        try { parsed = updateSchema.safeParse(JSON.parse(raw)); } catch { return Response.json({error:"Invalid enquiry update."},{status:400}); }
        if(!parsed.success) return Response.json({error:"Select up to 50 enquiries and a valid action."},{status:400});
        const db = getD1();
        if(!db) throw new Error("Missing enquiry storage");
        const {action,ids} = parsed.data, now=new Date().toISOString();
        const expression = action === "read" ? "json_set(value_json,'$.readAt',?)" : action === "unread" ? "json_remove(value_json,'$.readAt')" : action === "delete" ? "json_set(value_json,'$.deletedAt',?)" : "json_remove(value_json,'$.deletedAt')";
        const writes = [...new Set(ids)].map(id=>db.prepare(`UPDATE site_settings SET value_json=${expression}, updated_at=? WHERE key=?`).bind(...(action==="read"||action==="delete"?[now]:[]),now,"enquiry:"+id));
        await db.batch(writes);
        return Response.json({ok:true},{headers:noStore});
    } catch(error) {
        console.error("Enquiry update failed",error);
        return Response.json({error:"Changes were not saved. Please retry."},{status:503,headers:noStore});
    }
}
