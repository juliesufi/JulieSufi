import { getMysqlHttpD1 } from "./mysql-http-d1";
import { mysqlEnabled } from "./mysql-env";

let cached: D1Database | null = null;

/** MySQL access for the app. Uses a local Node proxy in dev (Workers cannot run mysql2). */
export function getMysqlD1(): D1Database | null {
  if (!mysqlEnabled()) return null;
  if (!cached) cached = getMysqlHttpD1();
  return cached;
}

export async function closeMysqlPool() {
  cached = null;
}
