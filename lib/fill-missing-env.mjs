import { existsSync, readFileSync } from "node:fs";

/** Parse KEY=VALUE lines. Blank values are omitted so they cannot clobber a real secret. */
export function parseEnvText(text) {
  const values = {};
  for (const line of String(text).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index <= 0) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key && value) values[key] = value;
  }
  return values;
}

/**
 * Copy only missing keys. A non-empty value already on `target` always wins,
 * which is the GoDaddy case: Publish secrets are in the environment before startup.
 * An empty string counts as missing so a blank local line cannot block a real value.
 */
export function fillMissingEnv(target, sources) {
  for (const source of sources) {
    if (!source) continue;
    for (const [key, value] of Object.entries(source)) {
      if (value && !target[key]) target[key] = value;
    }
  }
  return target;
}

export function readOptionalEnvFile(filePath) {
  try {
    if (!existsSync(filePath)) return {};
    return parseEnvText(readFileSync(filePath, "utf8"));
  } catch {
    return {};
  }
}
