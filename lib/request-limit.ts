import { getD1 } from "./site-data";

function clientAddress(request: Request) {
  const cloudflare = request.headers.get("cf-connecting-ip");
  if (cloudflare) return cloudflare.trim();
  if (process.env.TRUST_PROXY === "1") {
    const realIp = request.headers.get("x-real-ip")?.trim();
    if (realIp) return realIp;
    const forwarded = request.headers.get("x-forwarded-for");
    const lastHop = forwarded?.split(",").map((part) => part.trim()).filter(Boolean).at(-1);
    if (lastHop) return lastHop;
  }
  return "unknown";
}

// Fixed windows per client address. The address is hashed before it is stored.
export async function requestAllowed(
  request: Request,
  scope: "login" | "enquiry",
  maximum: number,
  seconds: number,
) {
  const db = getD1();
  if (!db) throw new Error("Request protection unavailable");
  const identity = clientAddress(request);
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(scope + ":" + identity),
  );
  const key =
    "request-limit:" +
    scope +
    ":" +
    Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
  const window = Math.floor(Date.now() / 1000 / seconds);
  const now = new Date().toISOString();

  const existing = await db
    .prepare("SELECT value_json FROM site_settings WHERE key = ? LIMIT 1")
    .bind(key)
    .first<{ value_json: string }>();

  let count = 1;
  if (existing?.value_json) {
    try {
      const parsed = JSON.parse(existing.value_json) as { window?: number; count?: number };
      if (parsed.window === window && Number.isFinite(Number(parsed.count))) {
        count = Number(parsed.count) + 1;
      }
    } catch {
      count = 1;
    }
  }

  await db
    .prepare(
      `INSERT INTO site_settings (key, value_json, updated_at) VALUES (?, ?, ?)
 ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
    )
    .bind(key, JSON.stringify({ window, count }), now)
    .run();

  // Periodically trim only expired limiter records; never touch customer content.
  if (crypto.getRandomValues(new Uint8Array(1))[0] === 0) {
    await db
      .prepare("DELETE FROM site_settings WHERE key GLOB 'request-limit:*' AND updated_at < ?")
      .bind(new Date(Date.now() - 86400000).toISOString())
      .run();
  }
  return count <= maximum;
}
