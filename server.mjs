import { resolve } from "node:path";
import { fillMissingEnv, readOptionalEnvFile } from "./lib/fill-missing-env.mjs";

// Host environment wins, including GoDaddy Publish secrets. Files only fill
// keys that are still empty. Blank lines are ignored. .dev.vars is not deployed.
fillMissingEnv(process.env, [
  readOptionalEnvFile(resolve(process.cwd(), ".env")),
  readOptionalEnvFile(resolve(process.cwd(), ".dev.vars")),
]);

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
