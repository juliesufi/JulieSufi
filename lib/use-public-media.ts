import { mysqlEnabled } from "./mysql-env";

/** MySQL hosting stores uploads under `public/`. */
export function usePublicMediaStorage() {
  return mysqlEnabled();
}
