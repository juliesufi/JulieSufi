import { env } from "cloudflare:workers";

type MysqlConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
};

function readEnv(name: string) {
  const worker = env as unknown as Record<string, string | undefined>;
  const fromWorker = worker[name];
  if (typeof fromWorker === "string" && fromWorker.length > 0) {
    return fromWorker;
  }
  if (typeof process !== "undefined" && process.env[name]) {
    return process.env[name];
  }
  return undefined;
}

export function mysqlConfig(): MysqlConfig | null {
  // GoDaddy Node.js Hosting injects DB_* when a hosted database is attached.
  // MYSQL_* remains the local development fallback.
  const database = process.env.DB_NAME ?? readEnv("MYSQL_DATABASE") ?? readEnv("DATABASE_NAME");
  if (!database) return null;
  return {
    host: process.env.DB_HOST ?? readEnv("MYSQL_HOST") ?? "127.0.0.1",
    port: Number(process.env.DB_PORT ?? readEnv("MYSQL_PORT") ?? "3306"),
    user: process.env.DB_USER ?? readEnv("MYSQL_USER") ?? "root",
    password: process.env.DB_PASSWORD ?? readEnv("MYSQL_PASSWORD") ?? "",
    database,
  };
}

export function mysqlEnabled() {
  return mysqlConfig() !== null;
}
