import { env } from "cloudflare:workers";

type RuntimeEnv = {
  ADMIN_PASSCODE?: string;
  ADMIN_SESSION_SECRET?: string;
};

const COOKIE_NAME = "julie_admin_session";
const MAX_AGE = 60 * 60 * 24 * 7;

function runtimeEnv() {
  return env as unknown as RuntimeEnv;
}

function configuredSecret(name: keyof RuntimeEnv) {
  // GoDaddy injects secrets on process.env before the server starts.
  // Prefer that over a worker binding so a blank or stale binding cannot hide them.
  if (typeof process !== "undefined" && process.env[name]) return process.env[name];
  const configured = runtimeEnv()[name];
  if (configured) return configured;
  return undefined;
}

export function getAdminPasscode() {
  const configured = configuredSecret("ADMIN_PASSCODE");
  if (configured) return configured;
  throw new Error("Admin password is not configured.");
}

function getAdminSessionSecret() {
  const configured = configuredSecret("ADMIN_SESSION_SECRET");
  if (configured) return configured;
  throw new Error("Admin session security is not configured.");
}

async function signingKey() {
  const signingSecret = getAdminSessionSecret();
  const secret = `${signingSecret}::${getAdminPasscode()}::admin-v2`;
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function base64Url(value: ArrayBuffer | string) {
  const encoded =
    typeof value === "string"
      ? btoa(value)
      : btoa(String.fromCharCode(...new Uint8Array(value)));
  return encoded.replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  return atob(normalized + "=".repeat((4 - (normalized.length % 4)) % 4));
}

async function sessionToken() {
  const expiresAt = Math.floor(Date.now() / 1000) + MAX_AGE;
  const payload = base64Url(`admin:${expiresAt}`);
  const key = await signingKey();
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return `${payload}.${base64Url(signature)}`;
}

function cookieToken(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  return match?.[1] ?? null;
}

export async function isAdminRequest(request: Request) {
  const token = cookieToken(request);
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  try {
  const decoded = fromBase64Url(payload);
  const [role, expiresAt] = decoded.split(":");
  if (role !== "admin" || !Number.isFinite(Number(expiresAt)) || Number(expiresAt) <= Math.floor(Date.now() / 1000)) return false;
  const key = await signingKey();
  const signatureBytes = Uint8Array.from(
    fromBase64Url(signature),
    (character) => character.charCodeAt(0),
  );
  return await crypto.subtle.verify(
    "HMAC",
    key,
    signatureBytes,
    new TextEncoder().encode(payload),
  );
  } catch { return false; }
}

export async function createAdminSession(request: Request) {
  const token = await sessionToken();
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE_NAME}=${token}; Max-Age=${MAX_AGE}; Path=/; HttpOnly; SameSite=Lax${secure}`;
}

export function clearAdminSession(request: Request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${secure}`;
}
