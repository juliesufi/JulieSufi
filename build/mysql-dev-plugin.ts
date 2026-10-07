import { readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import path from "node:path";
import type { ExecuteValues } from "mysql2/promise";
import type { Plugin, ViteDevServer } from "vite";
import { translateSql } from "../lib/mysql-sql";

type QueryPayload = {
  mode: "run" | "first" | "all" | "batch";
  sql?: string;
  args?: unknown[];
  queries?: { sql: string; args: unknown[] }[];
};

function readBody(req: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

async function getPool() {
  const mysql = await import("mysql2/promise");
  return mysql.createPool({
    host: process.env.MYSQL_HOST ?? "127.0.0.1",
    port: Number(process.env.MYSQL_PORT ?? "3306"),
    user: process.env.MYSQL_USER ?? "root",
    password: process.env.MYSQL_PASSWORD ?? "",
    database: process.env.MYSQL_DATABASE ?? "juliesufi",
    waitForConnections: true,
    connectionLimit: 10,
    timezone: "Z",
    dateStrings: true,
  });
}

let poolPromise: ReturnType<typeof getPool> | null = null;
let schemaReady: Promise<void> | null = null;

function pool() {
  poolPromise ??= getPool();
  return poolPromise;
}

/** Keep site_settings.updated_at as VARCHAR so admin revision UUIDs persist (not DATETIME). */
async function ensureLocalSchema() {
  const db = await pool();
  const schemaPath = path.join(process.cwd(), "scripts", "mysql-schema.sql");
  try {
    const sql = readFileSync(schemaPath, "utf8");
    for (const statement of sql.split(/;\s*[\r\n]+/).map((part) => part.trim()).filter(Boolean)) {
      if (statement.startsWith("--")) continue;
      await db.query(statement);
    }
  } catch (error) {
    console.warn("[mysql-dev-proxy] schema bootstrap skipped:", error instanceof Error ? error.message : error);
  }

  const [columns] = await db.query("SHOW COLUMNS FROM site_settings LIKE 'updated_at'");
  const column = (columns as Array<{ Type?: string }>)[0];
  const type = String(column?.Type ?? "").toLowerCase();
  if (type && !type.startsWith("varchar")) {
    await db.query(
      "ALTER TABLE site_settings MODIFY COLUMN `updated_at` VARCHAR(64) NOT NULL",
    );
    console.log("[mysql-dev-proxy] migrated site_settings.updated_at to VARCHAR(64) for admin revisions");
  }

  // Repair studio optimistic-lock tokens that DATETIME previously coerced to zero-dates.
  await db.query(
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
}

async function handleQuery(payload: QueryPayload) {
  schemaReady ??= ensureLocalSchema();
  await schemaReady;
  const db = await pool();
  if (payload.mode === "batch") {
    const queries = payload.queries ?? [];
    const connection = await db.getConnection();
    const results: unknown[] = [];
    try {
      await connection.beginTransaction();
      for (const query of queries) {
        const [rows] = await connection.execute(
          translateSql(query.sql),
          (query.args ?? []) as ExecuteValues,
        );
        const header = rows as { affectedRows?: number; insertId?: number };
        results.push({
          success: true,
          meta: {
            changes: header.affectedRows ?? 0,
            last_row_id: header.insertId || undefined,
          },
        });
      }
      await connection.commit();
      return { status: 200, body: { results } };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  const sql = translateSql(payload.sql ?? "");
  const args = payload.args ?? [];
  const [rows] = await db.execute(sql, args as ExecuteValues);
  if (payload.mode === "run") {
    const header = rows as { affectedRows?: number; insertId?: number };
    return {
      status: 200,
      body: {
        result: {
          success: true,
          meta: {
            changes: header.affectedRows ?? 0,
            last_row_id: header.insertId || undefined,
          },
        },
      },
    };
  }
  const list = rows as Record<string, unknown>[];
  if (payload.mode === "first") {
    return { status: 200, body: { row: list[0] ?? null } };
  }
  return { status: 200, body: { results: list } };
}

function createProxyHandler() {
  return async (req: IncomingMessage, res: ServerResponse) => {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "POST only." });
      return;
    }
    try {
      const payload = JSON.parse(await readBody(req)) as QueryPayload;
      const { status, body } = await handleQuery(payload);
      sendJson(res, status, body);
    } catch (error) {
      console.error("[mysql-dev-proxy]", error);
      sendJson(res, 503, {
        error: error instanceof Error ? error.message : "MySQL proxy failed.",
      });
    }
  };
}

export function mysqlDevProxyPort() {
  return Number(process.env.MYSQL_DEV_PROXY_PORT ?? "8788");
}

export function mysqlDevProxyOrigin() {
  return process.env.MYSQL_DEV_PROXY_ORIGIN ?? `http://127.0.0.1:${mysqlDevProxyPort()}`;
}

export function mysqlDevProxy(): Plugin {
  let proxy: Server | null = null;
  let viteServer: ViteDevServer | null = null;

  const start = () => {
    if (proxy) return;
    const port = mysqlDevProxyPort();
    proxy = createServer(createProxyHandler());
    proxy.listen(port, "127.0.0.1", () => {
      console.log(`[mysql-dev-proxy] listening on ${mysqlDevProxyOrigin()}`);
      schemaReady ??= ensureLocalSchema();
      schemaReady.catch((error) => {
        console.error("[mysql-dev-proxy] schema ensure failed", error);
        schemaReady = null;
      });
    });
    proxy.on("error", (error) => {
      console.error("[mysql-dev-proxy] failed to start", error);
    });
  };

  const stop = () => {
    if (!proxy) return;
    proxy.close();
    proxy = null;
  };

  return {
    name: "juliesufi-mysql-dev-proxy",
    configureServer(server) {
      viteServer = server;
      start();
      server.httpServer?.once("close", stop);
    },
    buildEnd() {
      if (viteServer) return;
      stop();
    },
  };
}
