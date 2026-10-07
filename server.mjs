import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(resolve(process.cwd(), ".env"));

const passenger = globalThis.PhusionPassenger;
if (passenger) passenger.configure({ autoInstall: false });

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "0.0.0.0";
if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  console.error("PORT must be an integer from 1 to 65535.");
  process.exit(1);
}

const { startProdServer } = await import("vinext/server/prod-server");
await startProdServer({ port, host, outDir: "dist" });
