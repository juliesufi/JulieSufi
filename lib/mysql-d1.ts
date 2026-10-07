import { mysqlEnabled } from "./mysql-env";
import { getMysqlNodeD1 } from "./mysql-node-d1";

let cached: D1Database | null = null;

/** MySQL access for the Node server. Uploads and content stay in this database. */
export function getMysqlD1(): D1Database | null {
  if (!mysqlEnabled()) return null;
  if (!cached) cached = getMysqlNodeD1();
  return cached;
}

export async function closeMysqlPool() {
  cached = null;
}
