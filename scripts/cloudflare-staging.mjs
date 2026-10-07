import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const wranglerBin = fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url));
const configPath = fileURLToPath(new URL("../wrangler.jsonc", import.meta.url));
const migrationsDir = fileURLToPath(new URL("../drizzle/", import.meta.url));

const DATABASE_NAME = "julie-sufi-staging";
const BUCKET_NAME = "julie-sufi-staging";
const PLACEHOLDER_DATABASE_ID = "00000000-0000-4000-8000-000000000001";

const command = process.argv[2];
if (!["prepare", "secrets"].includes(command)) {
  console.error("Usage: node scripts/cloudflare-staging.mjs <prepare|secrets>");
  process.exit(1);
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name}.`);
    process.exit(1);
  }
  return value;
}

function runWrangler(args, { input, allowFailure = false } = {}) {
  const result = spawnSync(process.execPath, [wranglerBin, ...args], {
    cwd: root,
    encoding: "utf8",
    input,
    env: process.env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFailure) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }
  return result;
}

function jsonFromOutput(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  return JSON.parse(text.slice(start, end + 1));
}

function databaseIdFromInfo(text) {
  const data = jsonFromOutput(text);
  const id = data?.uuid ?? data?.database_id;
  return typeof id === "string" ? id : null;
}

function assertSchemaOnlyMigrations() {
  const files = readdirSync(migrationsDir).filter((name) => name.endsWith(".sql")).sort();
  if (files.length === 0) {
    console.error("No SQL files in drizzle/. Refusing to deploy without a schema.");
    process.exit(1);
  }
  const forbidden = /^\s*(drop|delete|truncate|update|replace|insert)\b/im;
  for (const name of files) {
    const sql = readFileSync(join(migrationsDir, name), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/--.*$/gm, "");
    if (forbidden.test(sql)) {
      console.error(
        `${name} would change or remove existing rows. Staging deploy applies new tables and columns only.`,
      );
      process.exit(1);
    }
  }
}

function ensureDatabase() {
  const info = runWrangler(["d1", "info", DATABASE_NAME, "--json"], { allowFailure: true });
  const existingId = info.status === 0 ? databaseIdFromInfo(info.stdout) : null;
  if (existingId) return existingId;

  console.log(`Creating D1 database ${DATABASE_NAME}.`);
  runWrangler(["d1", "create", DATABASE_NAME, "--location", "oc"]);
  const created = runWrangler(["d1", "info", DATABASE_NAME, "--json"]);
  const id = databaseIdFromInfo(created.stdout);
  if (!id) {
    console.error("Cloudflare did not return a D1 database id.");
    process.exit(1);
  }
  return id;
}

function ensureBucket() {
  const info = runWrangler(["r2", "bucket", "info", BUCKET_NAME], { allowFailure: true });
  if (info.status === 0) return;
  console.log(`Creating R2 bucket ${BUCKET_NAME}.`);
  runWrangler(["r2", "bucket", "create", BUCKET_NAME, "--location", "oc"]);
}

function writeDatabaseId(databaseId) {
  const config = readFileSync(configPath, "utf8");
  const next = config.replace(
    /("database_id"\s*:\s*")[^"]+(")/,
    `$1${databaseId}$2`,
  );
  if (next === config && !config.includes(databaseId)) {
    console.error("Could not find database_id in wrangler.jsonc.");
    process.exit(1);
  }
  if (next !== config) writeFileSync(configPath, next);
}

function prepare() {
  assertSchemaOnlyMigrations();
  requireEnv("CLOUDFLARE_API_TOKEN");
  requireEnv("CLOUDFLARE_ACCOUNT_ID");
  const databaseId = ensureDatabase();
  if (databaseId === PLACEHOLDER_DATABASE_ID) {
    console.error("Refusing to deploy with the placeholder D1 id.");
    process.exit(1);
  }
  ensureBucket();
  writeDatabaseId(databaseId);
  console.log(`Staging database ${DATABASE_NAME} is ready. Existing rows were not modified.`);
}

function secrets() {
  requireEnv("CLOUDFLARE_API_TOKEN");
  requireEnv("CLOUDFLARE_ACCOUNT_ID");
  const payload = {
    ADMIN_PASSCODE: requireEnv("ADMIN_PASSCODE"),
    ADMIN_SESSION_SECRET: requireEnv("ADMIN_SESSION_SECRET"),
  };
  if (process.env.INSTAGRAM_ENCRYPTION_KEY) {
    payload.INSTAGRAM_ENCRYPTION_KEY = process.env.INSTAGRAM_ENCRYPTION_KEY;
  }
  const result = runWrangler(["secret", "bulk"], { input: JSON.stringify(payload) });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
}

if (command === "prepare") prepare();
if (command === "secrets") secrets();
