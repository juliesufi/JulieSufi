import { isAdminRequest } from "@/lib/admin-auth";
import { isSameOriginRequest } from "@/lib/request-origin";
import { studioSchema } from "@/lib/studio-model";
import { readStudio, saveStudio } from "@/lib/studio-store";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(request: Request) {
    if (!await isAdminRequest(request))
        return Response.json({ error: "Studio access required." }, { status: 401, headers });
    try {
        const v = await readStudio();
        return Response.json({ data: v.draft, revision: v.revision, publishedAt: v.publishedAt }, { headers });
    }
    catch {
        return Response.json({ error: "Unable to load saved content. Please retry." }, { status: 503, headers });
    }
}
export async function POST(request: Request) {
    if (!await isAdminRequest(request))
        return Response.json({ error: "Studio access required." }, { status: 401, headers });
    if (!isSameOriginRequest(request))
        return Response.json({ error: "Invalid origin." }, { status: 403 });
    try {
        const input = await request.text();
        if (input.length > 4000000)
            return Response.json({ error: "Content exceeds the 4 MB text limit. Upload media as files." }, { status: 413, headers });
        const body = JSON.parse(input);
        const parsed = studioSchema.safeParse(body.data);
        if (!parsed.success)
            return Response.json({ error: parsed.error.issues.map(e => e.path.join(" / ") + ": " + e.message).join("\n") }, { status: 400, headers });
        const v = await saveStudio(parsed.data, body.revision, body.publish === true);
        if (!v)
            return Response.json({ error: "Another tab saved newer changes. Your edits remain here. Open a new tab to compare before reloading." }, { status: 409, headers });
        return Response.json({ data: v.draft, revision: v.revision, publishedAt: v.publishedAt }, { headers });
    }
    catch {
        return Response.json({ error: "Your changes could not be saved. They remain in this editor; please retry." }, { status: 503, headers });
    }
}
