import { env } from "cloudflare:workers";
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: {
    params: Promise<{
        key: string[];
    }>;
}) {
    const key = (await params).key.join("/");
    if (!key.startsWith("images/") && !key.startsWith("videos/"))
        return new Response("Not found", { status: 404 });
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
