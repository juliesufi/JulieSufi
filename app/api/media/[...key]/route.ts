import { env } from "cloudflare:workers";
import { readMediaFile } from "@/lib/media-storage";
import { usePublicMediaStorage } from "@/lib/use-public-media";
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: {
    params: Promise<{
        key: string[];
    }>;
}) {
    const key = (await params).key.join("/");
    if (!key.startsWith("images/") && !key.startsWith("videos/"))
        return new Response("Not found", { status: 404 });
    if (usePublicMediaStorage()) {
        const rangeHeader = request.headers.get("Range");
        let range: { offset: number; length: number } | undefined;
        if (rangeHeader) {
            const match = /^bytes=(\d+)-(\d*)$/i.exec(rangeHeader.trim());
            if (match) {
                const start = Number(match[1]);
                const end = match[2] ? Number(match[2]) : undefined;
                if (Number.isFinite(start) && start >= 0) {
                    const stat = await readMediaFile(key);
                    if (!stat) return new Response("Not found", { status: 404 });
                    const last = end !== undefined && Number.isFinite(end) ? end : stat.size - 1;
                    if (last >= start) {
                        range = { offset: start, length: last - start + 1 };
                    }
                }
            }
        }
        const object = await readMediaFile(key, range);
        if (!object)
            return new Response("Not found", { status: 404 });
        const headers = new Headers();
        headers.set("Content-Type", object.contentType);
        headers.set("Cache-Control", "public, max-age=31536000, immutable");
        headers.set("Accept-Ranges", "bytes");
        headers.set("X-Content-Type-Options", "nosniff");
        if (range) {
            headers.set("Content-Range", `bytes ${range.offset}-${range.offset + range.length - 1}/${object.size}`);
            headers.set("Content-Length", String(range.length));
            const body = object.body instanceof Buffer ? object.body : Buffer.from(object.body);
            return new Response(body, { status: 206, headers });
        }
        headers.set("Content-Length", String(object.size));
        const body = object.body instanceof Buffer ? object.body : Buffer.from(object.body);
        return new Response(body, { headers });
    }
    const bucket = (env as unknown as {
        BUCKET?: R2Bucket;
    }).BUCKET;
    const object = await bucket?.get(key, { range: request.headers });
    if (!object)
        return new Response("Not found", { status: 404 });
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("Accept-Ranges", "bytes");
    headers.set("X-Content-Type-Options", "nosniff");
    const range = object.range as {
        offset?: number;
        length?: number;
    } | undefined;
    if (request.headers.has("Range") && range?.offset !== undefined && range.length !== undefined) {
        headers.set("Content-Range", `bytes ${range.offset}-${range.offset + range.length - 1}/${object.size}`);
        headers.set("Content-Length", String(range.length));
        return new Response(object.body, { status: 206, headers });
    }
    headers.set("Content-Length", String(object.size));
    return new Response(object.body, { headers });
}
