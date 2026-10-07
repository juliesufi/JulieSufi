import { mysqlEnabled } from "./mysql-env";

/** Local MySQL setup stores uploads under `public/`; Cloudflare keeps R2. */
export function usePublicMediaStorage() {
  return mysqlEnabled();
}
