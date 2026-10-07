import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vinext from "vinext";
import { defineConfig, loadEnv } from "vite";
import hostingConfig from "./.openai/hosting.json";
import { readExecutionProfile } from "./scripts/execution-profile.mjs";
import { mysqlDevProxy, mysqlDevProxyOrigin } from "./build/mysql-dev-plugin";
import { sites } from "./build/sites-vite-plugin";

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "00000000-0000-4000-8000-000000000000";

const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";
const managedLinux = readExecutionProfile() === "managed-linux";

function loadDevVars(root: string) {
  try {
    const text = readFileSync(resolve(root, ".dev.vars"), "utf8");
    const vars: Record<string, string> = {};
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index <= 0) continue;
      vars[trimmed.slice(0, index)] = trimmed.slice(index + 1);
    }
    return vars;
  } catch {
    return {};
  }
}

function workerVars(loaded: Record<string, string>) {
  const vars: Record<string, string> = {};
  for (const key of [
    "MYSQL_HOST",
    "MYSQL_PORT",
    "MYSQL_USER",
    "MYSQL_PASSWORD",
    "MYSQL_DATABASE",
    "ADMIN_PASSCODE",
    "ADMIN_SESSION_SECRET",
    "INSTAGRAM_ENCRYPTION_KEY",
    "MYSQL_DEV_PROXY_ORIGIN",
    "MYSQL_DEV_PROXY_PORT",
  ]) {
    const value = loaded[key];
    if (value !== undefined && value !== "") vars[key] = value;
  }
  if (loaded.MYSQL_DATABASE) {
    vars.MYSQL_HOST ??= "127.0.0.1";
    vars.MYSQL_PORT ??= "3306";
    vars.MYSQL_USER ??= "root";
    vars.MYSQL_PASSWORD ??= "";
    vars.MYSQL_DATABASE = loaded.MYSQL_DATABASE;
    vars.MYSQL_DEV_PROXY_ORIGIN ??= mysqlDevProxyOrigin();
  }
  return vars;
}

export default defineConfig(async ({ mode }) => {
  // Prefer Wrangler `.dev.vars` over `.env` so local Worker auth matches Cloudflare bindings.
  const loaded = { ...loadEnv(mode, process.cwd(), ""), ...loadDevVars(process.cwd()) };
  for (const [key, value] of Object.entries(loaded)) {
    if (value !== "") process.env[key] ??= value;
  }
  process.env.MYSQL_DEV_PROXY_ORIGIN ??=
    loaded.MYSQL_DEV_PROXY_ORIGIN ?? mysqlDevProxyOrigin();

  const localVars = workerVars(loaded);
  // wrangler.jsonc owns staging D1/R2 bindings. Fill those in only when the
  // file has none, so a production build does not swap in the local placeholders.
  const cloudflareConfig = (workerConfig: {
    compatibility_flags?: string[];
    d1_databases?: unknown[];
    r2_buckets?: unknown[];
  }) => {
    const flags = new Set(workerConfig.compatibility_flags ?? []);
    flags.add("nodejs_compat");
    return {
      main: "vinext/server/fetch-handler",
      compatibility_flags: [...flags],
      ...(Object.keys(localVars).length > 0 ? { vars: localVars } : {}),
      ...(!workerConfig.d1_databases?.length && d1
        ? {
            d1_databases: [
              {
                binding: d1,
                database_name: "site-creator-d1",
                database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
              },
            ],
          }
        : {}),
      ...(!workerConfig.r2_buckets?.length && r2
        ? {
            r2_buckets: [
              {
                binding: r2,
                bucket_name: "site-creator-r2",
              },
            ],
          }
        : {}),
    };
  };

  // Use Miniflare's local Request.cf placeholder unless fetching is requested.
  process.env.CLOUDFLARE_CF_FETCH_ENABLED ??= "false";
  process.env.WRANGLER_SEND_METRICS ??= "false";

  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.WRANGLER_REGISTRY_PATH ??= ".wrangler/dev-registry";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: {
      ...(managedLinux ? { host: "0.0.0.0", allowedHosts: ["terminal.local"] } : {}),
      ...(isCodexSeatbeltSandbox ? { watch: { useFsEvents: false, usePolling: true } } : {}),
    },
    // Keep vinext routing modules bundled so relative imports (e.g. route-trie → utils.js) resolve on Windows.
    ssr: {
      noExternal: ["vinext"],
    },
    plugins: [
      vinext(),
      ...(loaded.MYSQL_DATABASE ? [mysqlDevProxy()] : []),
      sites({ mockAuth: !managedLinux }),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
        config: cloudflareConfig,
      }),
    ],
  };
});
