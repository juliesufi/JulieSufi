import { resolve } from "node:path";
import { fillMissingEnv, readOptionalEnvFile } from "./fill-missing-env.mjs";

// Local files fill gaps only. GoDaddy Publish secrets are already on process.env
// and are never replaced. .dev.vars is not deployed.
const root = process.cwd();
fillMissingEnv(process.env, [
  readOptionalEnvFile(resolve(root, ".env")),
  readOptionalEnvFile(resolve(root, ".dev.vars")),
]);

/** Node stand-in for `cloudflare:workers`. Bindings come from the process environment. */
export const env = process.env;
