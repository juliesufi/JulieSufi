import assert from "node:assert/strict";
import { fillMissingEnv, parseEnvText } from "../lib/fill-missing-env.mjs";

const hosted = {
  ADMIN_PASSCODE: "hosted-password",
  ADMIN_SESSION_SECRET: "hosted-session-secret",
  DB_NAME: "hosted-db",
  DB_USER: "hosted-user",
  DB_PASSWORD: "hosted-db-password",
  TRUST_PROXY: "1",
};
fillMissingEnv(hosted, [
  parseEnvText(`
ADMIN_PASSCODE=
ADMIN_SESSION_SECRET=
MYSQL_PASSWORD=local-only
DB_NAME=local-db
DB_PASSWORD=local-db-password
`),
  parseEnvText(`
ADMIN_SESSION_SECRET=dev-vars-secret
ADMIN_PASSCODE=dev-vars-password
`),
]);
assert.equal(hosted.ADMIN_PASSCODE, "hosted-password");
assert.equal(hosted.ADMIN_SESSION_SECRET, "hosted-session-secret");
assert.equal(hosted.DB_NAME, "hosted-db");
assert.equal(hosted.DB_USER, "hosted-user");
assert.equal(hosted.DB_PASSWORD, "hosted-db-password");
assert.equal(hosted.TRUST_PROXY, "1");
assert.equal(hosted.MYSQL_PASSWORD, "local-only");

const local = {};
fillMissingEnv(local, [
  parseEnvText("ADMIN_PASSCODE=from-dotenv\nADMIN_SESSION_SECRET=\n"),
  parseEnvText("ADMIN_SESSION_SECRET=from-dev-vars\n"),
]);
assert.equal(local.ADMIN_PASSCODE, "from-dotenv");
assert.equal(local.ADMIN_SESSION_SECRET, "from-dev-vars");

const quoted = parseEnvText('ADMIN_SESSION_SECRET=""\nADMIN_PASSCODE="kept"\n');
assert.equal(quoted.ADMIN_SESSION_SECRET, undefined);
assert.equal(quoted.ADMIN_PASSCODE, "kept");

console.log("PASS: hosted GoDaddy secrets win; blank env lines do not block a real session secret.");
