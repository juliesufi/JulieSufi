import mysql from "mysql2/promise";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
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

const config = {
  host: process.env.MYSQL_HOST ?? "127.0.0.1",
  port: Number(process.env.MYSQL_PORT ?? "3306"),
  user: process.env.MYSQL_USER ?? "root",
  password: process.env.MYSQL_PASSWORD ?? "",
  database: process.env.MYSQL_DATABASE ?? "juliesufi",
  dateStrings: true,
  multipleStatements: true,
};

const connection = await mysql.createConnection(config);
const schema = readFileSync(path.join(root, "scripts", "mysql-schema.sql"), "utf8");
await connection.query(schema);

const [columns] = await connection.query("SHOW COLUMNS FROM site_settings LIKE 'updated_at'");
const type = String(columns[0]?.Type ?? "").toLowerCase();
if (type && !type.startsWith("varchar")) {
  await connection.query(
    "ALTER TABLE site_settings MODIFY COLUMN `updated_at` VARCHAR(64) NOT NULL",
  );
  console.log("Migrated site_settings.updated_at -> VARCHAR(64)");
}

await connection.query(
  `UPDATE site_settings
   SET updated_at = JSON_UNQUOTE(JSON_EXTRACT(value_json, '$.revision'))
   WHERE \`key\` = 'studio_v2'
     AND JSON_EXTRACT(value_json, '$.revision') IS NOT NULL
     AND (
       updated_at IS NULL
       OR updated_at IN ('', '0000-00-00 00:00:00', '0')
       OR CHAR_LENGTH(updated_at) < 30
     )`,
);

const [tables] = await connection.query("SHOW TABLES");
const [studio] = await connection.query(
  "SELECT `key`, updated_at, CHAR_LENGTH(value_json) AS bytes FROM site_settings WHERE `key` = 'studio_v2'",
);
console.log("Connected to", config.database, "— tables:", tables.length);
console.log("studio_v2:", studio[0] ?? "(missing — will be created on first admin load)");
console.log("updated_at column:", columns[0]?.Type, "->", (await connection.query("SHOW COLUMNS FROM site_settings LIKE 'updated_at'"))[0][0]?.Type);
await connection.end();
