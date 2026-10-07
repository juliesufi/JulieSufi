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
  const database = readEnv("MYSQL_DATABASE") ?? readEnv("DATABASE_NAME");
  if (!database) return null;
  return {
    host: readEnv("MYSQL_HOST") ?? "127.0.0.1",
    port: Number(readEnv("MYSQL_PORT") ?? "3306"),
    user: readEnv("MYSQL_USER") ?? "root",
    password: readEnv("MYSQL_PASSWORD") ?? "",
    database,
  };
}

export function mysqlEnabled() {
  return mysqlConfig() !== null;
}
