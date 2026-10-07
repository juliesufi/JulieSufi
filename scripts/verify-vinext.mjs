import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const required = [
  "node_modules/vinext/dist/routing/route-trie.js",
  "node_modules/vinext/dist/routing/utils.js",
  "node_modules/vinext/dist/cli.js",
];

const missing = required.filter((rel) => !existsSync(path.join(root, rel)));
if (missing.length) {
  console.error("vinext install is incomplete. Missing:");
  for (const file of missing) console.error("  -", file);
  console.error("\nRun: npm run repair:deps");
  process.exit(1);
}

console.log("vinext package OK");
