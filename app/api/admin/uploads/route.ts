import { env } from "cloudflare:workers";
import { isAdminRequest } from "@/lib/admin-auth";
import { getD1 } from "@/lib/site-data";
export const dynamic = "force-dynamic";
const CHUNK = 8 * 1024 * 1024;
const types = ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm", "video/quicktime"];
type Session = {
    key: string;
    uploadId: string;
    size: number;
    type: string;
    expires: number;
    parts: Record<string, R2UploadedPart>;
    complete?: boolean;
};
async function handle(request: Request) {
    if (!await isAdminRequest(request))
        return Response.json({ error: "Studio access required." }, { status: 401 });
    if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin)
        return Response.json({ error: "Invalid origin." }, { status: 403 });
    const db = getD1(), bucket = (env as unknown as {
        BUCKET?: R2Bucket;
    }).BUCKET;
    if (!db || !bucket)
        return Response.json({ error: "Upload storage is unavailable." }, { status: 503 });
    try {
        if (request.method === "POST") {
            const body = await request.json() as {
                name: string;
                type: string;
                size: number;
            };
            if (!types.includes(body.type) || !Number.isSafeInteger(body.size) || body.size <= 0 || typeof body.name !== "string")
                return Response.json({ error: "Choose a supported image or video." }, { status: 400 });
            const video = body.type.startsWith("video/"), limit = video ? 500 : 100;
            if (body.size > limit * 1024 * 1024)
                return Response.json({ error: "This file exceeds " + limit + " MB." }, { status: 413 });
            const id = crypto.randomUUID(), key = (video ? "videos/" : "images/") + id + "-" + body.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-150);
            const upload = await bucket.createMultipartUpload(key, { httpMetadata: { contentType: body.type, cacheControl: "public, max-age=31536000, immutable" } });
            const session: Session = { key, uploadId: upload.uploadId, size: body.size, type: body.type, expires: Date.now() + 24 * 60 * 60 * 1000, parts: {} };
            try {
                await db.prepare("INSERT INTO site_settings (key,value_json,updated_at) VALUES (?,?,?)").bind("upload:" + id, JSON.stringify(session), new Date().toISOString()).run();
            }
            catch (e) {
                await upload.abort();
                throw e;
            }
            return Response.json({ id, chunkSize: CHUNK });
        }
        const url = new URL(request.url), id = url.searchParams.get("id");
        if (!id || !/^[a-f0-9-]{36}$/.test(id))
            return Response.json({ error: "Invalid upload." }, { status: 400 });
        const row = await db.prepare("SELECT value_json FROM site_settings WHERE key=?").bind("upload:" + id).first<{
            value_json: string;
        }>();
        if (!row)
            return Response.json({ error: "Upload expired. Please choose the file again." }, { status: 404 });
        const s: Session = JSON.parse(row.value_json), upload = bucket.resumeMultipartUpload(s.key, s.uploadId);
        if (request.method === "DELETE") {
            if (!s.complete)
                await upload.abort();
            await db.prepare("DELETE FROM site_settings WHERE key=?").bind("upload:" + id).run();
            return Response.json({ ok: true });
        }
        if (s.expires < Date.now())
            return Response.json({ error: "Upload expired. Please retry." }, { status: 410 });
        if (request.method === "PUT") {
            const part = Number(url.searchParams.get("part")), count = Math.ceil(s.size / CHUNK);
            if (s.complete || !Number.isInteger(part) || part < 1 || part > count)
                return Response.json({ error: "Invalid upload part." }, { status: 400 });
            const expected = Math.min(CHUNK, s.size - (part - 1) * CHUNK);
            if (!request.body)
                return Response.json({ error: "Empty upload part." }, { status: 400 });
            const reader = request.body.getReader(), chunks: Uint8Array[] = [];
            let length = 0;
            for (;;) {
                const r = await reader.read();
                if (r.done)
                    break;
                length += r.value.byteLength;
                if (length > expected) {
                    await reader.cancel();
                    return Response.json({ error: "Upload part is too large." }, { status: 413 });
                }
                chunks.push(r.value);
            }
            if (length !== expected)
                return Response.json({ error: "Upload interrupted. Retry this part." }, { status: 400 });
            const bytes = new Uint8Array(length);
            let offset = 0;
            for (const chunk of chunks) {
                bytes.set(chunk, offset);
                offset += chunk.length;
            }
            const uploaded = await upload.uploadPart(part, bytes);
            s.parts[String(part)] = uploaded;
            await db.prepare("UPDATE site_settings SET value_json=? WHERE key=?").bind(JSON.stringify(s), "upload:" + id).run();
            return Response.json({ ok: true });
        }
        if (request.method === "PATCH") {
            const existing = await bucket.head(s.key);
            if (existing && existing.size === s.size)
                return Response.json({ url: "/api/media/" + s.key, type: s.type.startsWith("video/") ? "video" : "image" });
            const parts = Array.from({ length: Math.ceil(s.size / CHUNK) }, (_, i) => s.parts[String(i + 1)]);
            if (parts.some(p => !p))
                return Response.json({ error: "Some file parts are missing. Please retry." }, { status: 400 });
            const object = await upload.complete(parts);
            if (object.size !== s.size) {
                await bucket.delete(s.key);
                throw new Error("Size mismatch");
            }
            s.complete = true;
            await db.prepare("UPDATE site_settings SET value_json=? WHERE key=?").bind(JSON.stringify(s), "upload:" + id).run();
            return Response.json({ url: "/api/media/" + s.key, type: s.type.startsWith("video/") ? "video" : "image" });
        }
        return Response.json({ error: "Unsupported operation." }, { status: 405 });
    }
    catch (error) {
        console.error("Multipart upload failed", error);
        return Response.json({ error: "Upload interrupted. Please retry; saved content is unchanged." }, { status: 503 });
    }
}
export const POST = handle, PUT = handle, PATCH = handle, DELETE = handle;
