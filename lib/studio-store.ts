import { getD1, readSiteData } from "./site-data";
import { migrate, type StudioData } from "./studio-model";
export type Envelope = {
    draft: StudioData;
    live: StudioData;
    revision: string;
    publishedAt: string | null;
};
export async function readStudio(): Promise<Envelope> {
    const db = getD1();
    if (!db)
        throw new Error("Studio database unavailable.");
    let row = await db.prepare("SELECT value_json FROM site_settings WHERE key = ?").bind("studio_v2").first<{
        value_json: string;
    }>();
    if (!row) {
        const data = migrate(await readSiteData(db, true));
        const revision = crypto.randomUUID();
        const initial: Envelope = { draft: data, live: data, revision, publishedAt: null };
        await db.prepare("INSERT OR IGNORE INTO site_settings (key,value_json,updated_at) VALUES (?,?,?)").bind("studio_v2", JSON.stringify(initial), revision).run();
        row = await db.prepare("SELECT value_json FROM site_settings WHERE key = ?").bind("studio_v2").first<{
            value_json: string;
        }>();
    }
    if (!row)
        throw new Error("Unable to load the studio.");
    return JSON.parse(row.value_json);
}
export async function saveStudio(data: StudioData, revision: string, publish: boolean) {
    const db = getD1();
    if (!db)
        throw new Error("Studio database unavailable.");
    const current = await readStudio();
    const next: Envelope = { draft: data, live: publish ? data : current.live, revision: crypto.randomUUID(), publishedAt: publish ? new Date().toISOString() : current.publishedAt };
    const saved = await db.prepare("UPDATE site_settings SET value_json = ?, updated_at = ? WHERE key = ? AND updated_at = ?").bind(JSON.stringify(next), next.revision, "studio_v2", revision).run();
    return saved.meta.changes ? next : null;
}
