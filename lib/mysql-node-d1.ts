import { readFileSync } from "node:fs";
import path from "node:path";
import mysql, { type ExecuteValues, type Pool, type ResultSetHeader } from "mysql2/promise";
import { mysqlConfig } from "./mysql-env";
import { translateSql } from "./mysql-sql";

type RunResult = {
  success: boolean;
  meta: { changes: number; last_row_id?: number };
};

function schemaStatements(sql: string) {
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((part) =>
      part
        .split(/\r?\n/)
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter(Boolean);
}

function runResult(rows: unknown): RunResult {
  const header = rows as ResultSetHeader;
  return {
    success: true,
    meta: {
      changes: header.affectedRows ?? 0,
      last_row_id: header.insertId || undefined,
    },
  };
}

async function ensureSchema(pool: Pool) {
  const statements = schemaStatements(
    readFileSync(path.join(process.cwd(), "scripts", "mysql-schema.sql"), "utf8"),
  );
  for (const statement of statements) {
    const verb = statement.slice(0, 12).toLowerCase();
    if (!verb.startsWith("create") && !verb.startsWith("alter")) {
      throw new Error("Refusing a schema statement that is not CREATE or ALTER.");
    }
    await pool.query(statement);
  }

  const [columns] = await pool.query("SHOW COLUMNS FROM site_settings LIKE 'updated_at'");
  const column = (columns as Array<{ Type?: string }>)[0];
  const type = String(column?.Type ?? "").toLowerCase();
  if (type && !type.startsWith("varchar")) {
    await pool.query("ALTER TABLE site_settings MODIFY COLUMN `updated_at` VARCHAR(64) NOT NULL");
  }
}

let poolPromise: Promise<Pool> | null = null;

function pool() {
  const config = mysqlConfig();
  if (!config) throw new Error("MySQL is not configured.");
  poolPromise ??= (async () => {
    const created = mysql.createPool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      waitForConnections: true,
      connectionLimit: 10,
      timezone: "Z",
      dateStrings: true,
    });
    await ensureSchema(created);
    return created;
  })();
  return poolPromise;
}

class NodeMysqlPreparedStatement {
  constructor(
    readonly sql: string,
    readonly args: unknown[] = [],
  ) {}

  bind(...args: unknown[]) {
    return new NodeMysqlPreparedStatement(this.sql, args);
  }

  async run() {
    const [rows] = await (await pool()).execute(translateSql(this.sql), this.args as ExecuteValues);
    return runResult(rows);
  }

  async first<T>() {
    const [rows] = await (await pool()).execute(translateSql(this.sql), this.args as ExecuteValues);
    return ((rows as T[])[0] ?? null) as T | null;
  }

  async all<T>() {
    const [rows] = await (await pool()).execute(translateSql(this.sql), this.args as ExecuteValues);
    return { results: (rows as T[]) ?? [] };
  }
}

class NodeMysqlDatabase {
  prepare(sql: string) {
    return new NodeMysqlPreparedStatement(sql);
  }

  async batch(statements: NodeMysqlPreparedStatement[]) {
    const connection = await (await pool()).getConnection();
    const results: RunResult[] = [];
    try {
      await connection.beginTransaction();
      for (const statement of statements) {
        const [rows] = await connection.execute(
          translateSql(statement.sql),
          statement.args as ExecuteValues,
        );
        results.push(runResult(rows));
      }
      await connection.commit();
      return results;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

let database: D1Database | null = null;

export function getMysqlNodeD1(): D1Database {
  database ??= new NodeMysqlDatabase() as unknown as D1Database;
  return database;
}
