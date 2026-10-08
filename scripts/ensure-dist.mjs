import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const serverEntry = join(root, "dist", "server", "index.js");
const staticDir = join(root, "dist", "server", "_next", "static");

function staticImports(source) {
  const found = new Set();
  for (const match of source.matchAll(/["']\.\/_next\/static\/([^"'\\]+)["']/g)) {
    found.add(match[1]);
  }
  return [...found];
}

function distLooksComplete() {
  if (!existsSync(serverEntry) || !existsSync(staticDir)) return false;
  let source;
  try {
    source = readFileSync(serverEntry, "utf8");
  } catch {
    return false;
  }
  const imports = staticImports(source);
  if (imports.length === 0) return false;
  for (const relative of imports) {
    if (!existsSync(join(staticDir, relative))) return false;
  }
  // Guard against truncated hashes like "app-page-cache-C6Vg4zv-.js".
  if (imports.some((name) => /-[.]js$|-$/.test(name))) return false;
  try {
    return readdirSync(staticDir).length > 0;
  } catch {
    return false;
  }
}

if (distLooksComplete()) {
  process.exit(0);
}

console.log("[ensure-dist] Rebuilding production assets…");
rmSync(join(root, "dist"), { recursive: true, force: true });
const result = spawnSync(
  process.platform === "win32" ? "pnpm.cmd" : "pnpm",
  ["run", "build"],
  { cwd: root, stdio: "inherit", env: process.env, shell: process.platform === "win32" },
);
if ((result.status ?? 1) !== 0) {
  console.error("[ensure-dist] Build failed.");
  process.exit(result.status ?? 1);
}
if (!distLooksComplete()) {
  console.error("[ensure-dist] Build finished but dist is still incomplete.");
  process.exit(1);
}
