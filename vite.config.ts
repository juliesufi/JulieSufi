import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vinext from "vinext";
import { defineConfig, loadEnv } from "vite";
import { readExecutionProfile } from "./scripts/execution-profile.mjs";
import { sites } from "./build/sites-vite-plugin";
import { fillMissingEnv, readOptionalEnvFile } from "./lib/fill-missing-env.mjs";

const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";
const managedLinux = readExecutionProfile() === "managed-linux";

export default defineConfig(async ({ mode }) => {
  const platformPort = Number(process.env.PORT);
  const hosted = Number.isInteger(platformPort) && platformPort > 0 && platformPort <= 65535;
  // Host environment wins. .dev.vars then fills any key the host left empty.
  const loaded = {
    ...loadEnv(mode, process.cwd(), ""),
    ...readOptionalEnvFile(resolve(process.cwd(), ".dev.vars")),
  };
  fillMissingEnv(process.env, [loaded]);
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
