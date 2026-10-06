export async function uploadMedia(file: File, onProgress: (percentage: number) => void): Promise<{
    url: string;
    type: "image" | "video";
}> {
    const video = file.type.startsWith("video/");
    if (file.size > (video ? 500 : 100) * 1024 * 1024)
        throw new Error(video ? "Video exceeds 500 MB." : "Photo exceeds 100 MB.");
    async function request(path: string, options: RequestInit) { const r = await fetch(path, options); const data = await r.json() as any; if (!r.ok)
        throw new Error(data.error || "Upload failed. Please retry."); return data; }
    const session = await request("/api/admin/uploads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: file.name, type: file.type, size: file.size }) });
    try {
        for (let start = 0, part = 1; start < file.size; start += session.chunkSize, part++) {
            const chunk = file.slice(start, Math.min(file.size, start + session.chunkSize));
            for (let attempt = 0;; attempt++) {
                try {
                    await request("/api/admin/uploads?id=" + session.id + "&part=" + part, { method: "PUT", body: chunk });
                    break;
                }
                catch (e) {
                    if (attempt >= 2)
                        throw e;
                }
            }
            onProgress(Math.round(Math.min(file.size, start + chunk.size) / file.size * 100));
        }
        return await request("/api/admin/uploads?id=" + session.id, { method: "PATCH" });
    }
    catch (error) {
        await fetch("/api/admin/uploads?id=" + session.id, { method: "DELETE" }).catch(() => { });
        throw error;
    }
}
