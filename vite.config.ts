import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vinext from "vinext";
import { defineConfig, loadEnv } from "vite";
import { readExecutionProfile } from "./scripts/execution-profile.mjs";
import { sites } from "./build/sites-vite-plugin";

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

export default defineConfig(async ({ mode }) => {
  const platformPort = Number(process.env.PORT);
  const hosted = Number.isInteger(platformPort) && platformPort > 0 && platformPort <= 65535;
  const loaded = { ...loadEnv(mode, process.cwd(), ""), ...loadDevVars(process.cwd()) };
  for (const [key, value] of Object.entries(loaded)) {
    if (value !== "") process.env[key] ??= value;
  }
  if (loaded.MYSQL_DATABASE) {
    process.env.MYSQL_HOST ??= loaded.MYSQL_HOST || "127.0.0.1";
    process.env.MYSQL_PORT ??= loaded.MYSQL_PORT || "3306";
    process.env.MYSQL_USER ??= loaded.MYSQL_USER || "root";
    process.env.MYSQL_PASSWORD ??= loaded.MYSQL_PASSWORD ?? "";
    process.env.MYSQL_DATABASE ??= loaded.MYSQL_DATABASE;
  }

  return {
    resolve: {
      alias: {
        "cloudflare:workers": fileURLToPath(new URL("./lib/cloudflare-workers-node.ts", import.meta.url)),
      },
    },
    server: {
      ...(hosted
        ? { host: "0.0.0.0", port: platformPort, strictPort: true, allowedHosts: true }
        : managedLinux
          ? { host: "0.0.0.0", allowedHosts: ["terminal.local"] }
          : {}),
      ...(isCodexSeatbeltSandbox ? { watch: { useFsEvents: false, usePolling: true } } : {}),
    },
    ssr: {
      external: ["mysql2"],
      noExternal: ["vinext"],
    },
    plugins: [
      vinext(),
      sites({ mockAuth: !managedLinux }),
    ],
  };
});
