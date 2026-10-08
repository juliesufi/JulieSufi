import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

const root = process.cwd();

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const value = line.trim();
    if (!value || value.startsWith("#")) continue;
    const at = value.indexOf("=");
    if (at < 1) continue;
    let parsed = value.slice(at + 1).trim();
    if (
      (parsed.startsWith('"') && parsed.endsWith('"')) ||
      (parsed.startsWith("'") && parsed.endsWith("'"))
    ) {
      parsed = parsed.slice(1, -1);
    }
    process.env[value.slice(0, at).trim()] ??= parsed;
  }
}

loadEnvFile(path.join(root, ".env"));
loadEnvFile(path.join(root, ".dev.vars"));

const data = JSON.parse(
  readFileSync(path.join(root, "scripts", "live-storefront-v11.json"), "utf8"),
);

if (
  data.version !== 2 ||
  !Array.isArray(data.home) ||
  !Array.isArray(data.pages) ||
  !Array.isArray(data.collections)
) {
  throw new Error("The storefront snapshot is not a valid studio_v2 document.");
}

const config = {
  host: process.env.DB_HOST ?? process.env.MYSQL_HOST ?? "127.0.0.1",
  port: Number(process.env.DB_PORT ?? process.env.MYSQL_PORT ?? "3306"),
  user: process.env.DB_USER ?? process.env.MYSQL_USER ?? "root",
  password: process.env.DB_PASSWORD ?? process.env.MYSQL_PASSWORD ?? "",
  database:
    process.env.DB_NAME ??
    process.env.MYSQL_DATABASE ??
    process.env.DATABASE_NAME,
};

if (!config.database) {
  throw new Error("No DB_NAME or MYSQL_DATABASE is configured.");
}

const productCount = data.collections.reduce(
  (total, collection) => total + collection.products.length,
  0,
);

if (!process.argv.includes("--confirm")) {
  console.log(
    `Dry run: ${data.collections.length} collections, ${productCount} products, ${data.pages.length} pages.`,
  );
  console.log("Run again with --confirm to back up and publish this snapshot.");
  process.exit(0);
}

const connection = await mysql.createConnection(config);
try {
  await connection.beginTransaction();
  const [rows] = await connection.execute(
    "SELECT `key`, value_json, updated_at FROM site_settings WHERE `key` = ? FOR UPDATE",
    ["studio_v2"],
  );

  const backupDir = path.join(root, ".sites-runtime", "backups");
  mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(
    backupDir,
    `studio_v2-before-live-import-${stamp}.json`,
  );
  writeFileSync(backupPath, JSON.stringify(rows[0] ?? null, null, 2));

  const revision = crypto.randomUUID();
  const envelope = {
    draft: data,
    live: data,
    revision,
    publishedAt: new Date().toISOString(),
  };

  await connection.execute(
    `INSERT INTO site_settings (\`key\`, value_json, updated_at)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE value_json = VALUES(value_json), updated_at = VALUES(updated_at)`,
    ["studio_v2", JSON.stringify(envelope), revision],
  );
  await connection.commit();
  console.log(`Published the live storefront snapshot. Backup: ${backupPath}`);
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  await connection.end();
}
