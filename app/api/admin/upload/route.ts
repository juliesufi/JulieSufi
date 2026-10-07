import { env } from "cloudflare:workers";
import { isAdminRequest } from "@/lib/admin-auth";
import { writeMediaStream } from "@/lib/media-storage";
import { usePublicMediaStorage } from "@/lib/use-public-media";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
    if (!await isAdminRequest(request))
        return Response.json({ error: "Studio access required." }, { status: 401 });
    if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin)
        return Response.json({ error: "Invalid origin." }, { status: 403 });
    try {
        const file = (await request.formData()).get("file");
        const types = ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm", "video/quicktime"];
        if (!(file instanceof File) || !types.includes(file.type) || !file.size)
            return Response.json({ error: "Choose JPG, PNG, WebP, GIF, MP4, WebM or MOV." }, { status: 400 });
        const video = file.type.startsWith("video/"), limit = video ? 80 : 12;
        if (file.size > limit * 1024 * 1024)
            return Response.json({ error: "This file exceeds the " + limit + " MB limit. Compress it and retry." }, { status: 400 });
        const name = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-") || "media";
        const key = (video ? "videos/" : "images/") + crypto.randomUUID() + "-" + name;
        if (usePublicMediaStorage()) {
            await writeMediaStream(key, file.stream());
        }
        else {
            const bucket = (env as unknown as {
                BUCKET?: R2Bucket;
            }).BUCKET;
            if (!bucket)
                return Response.json({ error: "Media storage is unavailable." }, { status: 503 });
            await bucket.put(key, file.stream(), { httpMetadata: { contentType: file.type, cacheControl: "public, max-age=31536000, immutable" } });
        }
        return Response.json({ url: "/api/media/" + key, type: video ? "video" : "image" });
    }
    catch {
        return Response.json({ error: "Upload failed. Please retry; your other edits are unchanged." }, { status: 503 });
    }
}
