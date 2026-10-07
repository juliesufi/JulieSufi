import { env } from "cloudflare:workers";
type D1RunResult = {
  success: boolean;
  meta: { changes: number; last_row_id?: number };
};

type QueryPayload = {
  mode: "run" | "first" | "all" | "batch";
  sql?: string;
  args?: unknown[];
  queries?: { sql: string; args: unknown[] }[];
};

function proxyOrigin() {
  const worker = env as unknown as Record<string, string | undefined>;
  return (
    worker.MYSQL_DEV_PROXY_ORIGIN ??
    (typeof process !== "undefined" ? process.env.MYSQL_DEV_PROXY_ORIGIN : undefined) ??
    "http://127.0.0.1:8788"
  );
}

async function postQuery(payload: QueryPayload) {
  const origin = proxyOrigin().replace(/\/$/, "");
  let response: Response;
  try {
    response = await fetch(origin, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    throw new Error(
      `MySQL dev proxy unreachable at ${origin}. Restart npm run dev and ensure MySQL is running. ${error instanceof Error ? error.message : ""}`.trim(),
    );
  }
  const text = await response.text();
  let body: { error?: string } & Record<string, unknown> = {};
  try {
    body = text ? (JSON.parse(text) as typeof body) : {};
  } catch {
    throw new Error(`MySQL dev proxy returned invalid JSON (${response.status}): ${text.slice(0, 200)}`);
  }
  if (!response.ok) {
    throw new Error(body.error ?? `MySQL proxy request failed (${response.status}).`);
  }
  return body;
}

class HttpMysqlPreparedStatement {
  readonly sql: string;
  readonly args: unknown[];

  constructor(sql: string, args: unknown[] = []) {
    this.sql = sql;
    this.args = args;
  }

  bind(...args: unknown[]) {
    return new HttpMysqlPreparedStatement(this.sql, args);
  }

  async run(): Promise<D1RunResult> {
    const body = await postQuery({
      mode: "run",
      sql: this.sql,
      args: this.args,
    });
    return body.result as D1RunResult;
  }

  async first<T>() {
    const body = await postQuery({
      mode: "first",
      sql: this.sql,
      args: this.args,
    });
    return (body.row as T | null | undefined) ?? null;
  }

  async all<T>() {
    const body = await postQuery({
      mode: "all",
      sql: this.sql,
      args: this.args,
    });
    return { results: (body.results as T[]) ?? [] };
  }
}

class HttpMysqlD1Database {
  prepare(sql: string) {
    return new HttpMysqlPreparedStatement(sql);
  }

  async batch(statements: HttpMysqlPreparedStatement[]) {
    const body = await postQuery({
      mode: "batch",
      queries: statements.map((statement) => ({
        sql: statement.sql,
        args: statement.args,
      })),
    });
    return body.results as D1RunResult[];
  }
}

let httpD1: HttpMysqlD1Database | null = null;

export function getMysqlHttpD1(): D1Database {
  if (!httpD1) httpD1 = new HttpMysqlD1Database();
  return httpD1 as unknown as D1Database;
}
