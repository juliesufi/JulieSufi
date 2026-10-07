import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const root = fileURLToPath(new URL("..", import.meta.url));

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
    process.env[key] ??= value;
  }
}

loadEnvFile(path.join(root, ".env"));
loadEnvFile(path.join(root, ".dev.vars"));

const database = process.env.MYSQL_DATABASE || process.env.DATABASE_NAME;
if (!database) {
  console.error("MYSQL_DATABASE is missing. Put it in the server .env file before deploying.");
  process.exit(1);
}

const schemaPath = path.join(root, "scripts", "mysql-schema.sql");
const statements = readFileSync(schemaPath, "utf8")
  .split(/;\s*(?:\r?\n|$)/)
  .map((part) =>
    part
      .split(/\r?\n/)
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n")
      .trim(),
  )
  .filter(Boolean);

const forbidden = /^(drop|delete|truncate|update|replace|insert)\b/i;
for (const statement of statements) {
  if (forbidden.test(statement)) {
    console.error("Refusing a schema file that would change or remove existing rows.");
    process.exit(1);
  }
}

const connection = await mysql.createConnection({
  host: process.env.MYSQL_HOST ?? "127.0.0.1",
  port: Number(process.env.MYSQL_PORT ?? "3306"),
  user: process.env.MYSQL_USER ?? "root",
  password: process.env.MYSQL_PASSWORD ?? "",
  database,
  dateStrings: true,
  multipleStatements: false,
});

try {
  for (const statement of statements) {
    await connection.query(statement);
  }

  const [columns] = await connection.query("SHOW COLUMNS FROM site_settings LIKE 'updated_at'");
  const type = String(columns[0]?.Type ?? "").toLowerCase();
  if (type && !type.startsWith("varchar")) {
    await connection.query("ALTER TABLE site_settings MODIFY COLUMN `updated_at` VARCHAR(64) NOT NULL");
    console.log("Adjusted site_settings.updated_at to VARCHAR(64).");
  }

  const [tables] = await connection.query("SHOW TABLES");
  console.log(`Schema ready on ${database}. Tables: ${tables.length}. Existing content was kept.`);
} finally {
  await connection.end();
}
