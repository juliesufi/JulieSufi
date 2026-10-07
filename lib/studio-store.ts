import { getD1, readSiteData } from "./site-data";
import { migrate, type StudioData } from "./studio-model";
export type Envelope = {
    draft: StudioData;
    live: StudioData;
    revision: string;
    publishedAt: string | null;
};

function isStudioData(value: unknown): value is StudioData {
    return !!value && typeof value === "object" && (value as StudioData).version === 2 && Array.isArray((value as StudioData).home);
}

function isEnvelope(value: unknown): value is Envelope {
    return isStudioData((value as Envelope)?.draft) && isStudioData((value as Envelope)?.live);
}

function studioNeedsRebuild(data: StudioData) {
    return !data.settings?.brandName || data.home.length === 0;
}

async function buildInitialEnvelope(db: NonNullable<ReturnType<typeof getD1>>) {
    const data = migrate(await readSiteData(db, true));
    const revision = crypto.randomUUID();
    return { draft: data, live: data, revision, publishedAt: null } satisfies Envelope;
}

async function persistEnvelope(db: NonNullable<ReturnType<typeof getD1>>, envelope: Envelope) {
    await db
        .prepare("INSERT INTO site_settings (key,value_json,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at")
        .bind("studio_v2", JSON.stringify(envelope), envelope.revision)
        .run();
}

function normalizeStoredStudio(value: unknown, revisionFallback: string): Envelope | null {
    if (isEnvelope(value))
        return value;
    if (isStudioData(value)) {
        const revision = revisionFallback || crypto.randomUUID();
        return { draft: value, live: value, revision, publishedAt: null };
    }
    return null;
}

export async function readStudio(): Promise<Envelope> {
    const db = getD1();
    if (!db)
        throw new Error("Studio database unavailable.");
    let row = await db.prepare("SELECT value_json, updated_at FROM site_settings WHERE key = ?").bind("studio_v2").first<{
        value_json: string;
        updated_at: string;
    }>();
    if (!row) {
        const initial = await buildInitialEnvelope(db);
        await db.prepare("INSERT OR IGNORE INTO site_settings (key,value_json,updated_at) VALUES (?,?,?)").bind("studio_v2", JSON.stringify(initial), initial.revision).run();
        row = await db.prepare("SELECT value_json, updated_at FROM site_settings WHERE key = ?").bind("studio_v2").first<{
            value_json: string;
            updated_at: string;
        }>();
    }
    if (!row)
        throw new Error("Unable to load the studio.");
    let parsed: unknown;
    try {
        parsed = JSON.parse(row.value_json);
    }
    catch {
        parsed = null;
    }
    let envelope = normalizeStoredStudio(parsed, row.updated_at);
    if (!envelope || studioNeedsRebuild(envelope.live)) {
        envelope = await buildInitialEnvelope(db);
        await persistEnvelope(db, envelope);
    }
    else if (!isEnvelope(parsed)) {
        await persistEnvelope(db, envelope);
    }
    return envelope;
}
export async function saveStudio(data: StudioData, revision: string, publish: boolean) {
    const db = getD1();
    if (!db)
        throw new Error("Studio database unavailable.");
    const current = await readStudio();
    if (current.revision !== revision)
        return null;
    const next: Envelope = { draft: data, live: publish ? data : current.live, revision: crypto.randomUUID(), publishedAt: publish ? new Date().toISOString() : current.publishedAt };
    const saved = await db.prepare("UPDATE site_settings SET value_json = ?, updated_at = ? WHERE key = ? AND updated_at = ?").bind(JSON.stringify(next), next.revision, "studio_v2", revision).run();
    if (saved.meta.changes)
        return next;
    // Legacy local MySQL used DATETIME for updated_at, which coerced UUID revisions to zero-dates.
    // JSON revision already matched above, so persist by key and restore a real VARCHAR token.
    const repaired = await db.prepare("UPDATE site_settings SET value_json = ?, updated_at = ? WHERE key = ?").bind(JSON.stringify(next), next.revision, "studio_v2").run();
    return repaired.meta.changes ? next : null;
}
