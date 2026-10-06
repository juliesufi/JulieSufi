import { isAdminRequest } from "@/lib/admin-auth";
import { publicData } from "@/lib/studio-model";
import { readStudio } from "@/lib/studio-store";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
    const headers = { "Cache-Control": "private, no-store" };
    const preview = new URL(request.url).searchParams.get("preview") === "1";
    if (preview && !await isAdminRequest(request))
        return Response.json({ error: "Admin login required to preview drafts." }, { status: 401, headers });
    try {
        const v = await readStudio();
        return Response.json(publicData(preview ? v.draft : v.live), { headers });
    }
    catch {
        return Response.json({ error: "The website could not load. Please try again." }, { status: 503, headers });
    }
}
