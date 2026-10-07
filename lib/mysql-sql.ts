export function translateSql(sql: string) {
  let next = sql.trim();
  next = next.replace(/\bINSERT OR IGNORE\b/gi, "INSERT IGNORE");
  next = next.replace(/\bON CONFLICT\s*\([^)]+\)\s*DO UPDATE SET\b/gi, "ON DUPLICATE KEY UPDATE");
  next = next.replace(/\bexcluded\.([a-zA-Z_][a-zA-Z0-9_]*)/gi, "VALUES($1)");
  next = next.replace(/\bjson_object\s*\(/gi, "JSON_OBJECT(");
  next = next.replace(/\bjson_extract\s*\(/gi, "JSON_EXTRACT(");
  next = next.replace(/\bjson_set\s*\(/gi, "JSON_SET(");
  next = next.replace(/\bjson_remove\s*\(/gi, "JSON_REMOVE(");
  next = next.replace(/\bkey GLOB '([^']+)'/gi, (_, pattern: string) => {
    const like = pattern.replace(/\*/g, "%").replace(/\?/g, "_");
    return "`key` LIKE '" + like + "'";
  });
  next = next.replace(/\bsite_settings\s*\(\s*key\b/gi, "site_settings (`key`");
  next = next.replace(/\(\s*key\s*,/gi, "(`key`,");
  next = next.replace(/\bWHERE key\b/gi, "WHERE `key`");
  next = next.replace(/\bWHERE key=/gi, "WHERE `key`=");
  next = next.replace(/\bAND key\b/gi, "AND `key`");
  next = next.replace(/,\s*key ASC\b/gi, ", `key` ASC");
  next = next.replace(/\binstr\s*\(/gi, "INSTR(");
  next = next.replace(
    /JSON_EXTRACT\(value_json,'\$\.name'\)\s+COLLATE NOCASE ASC/gi,
    "LOWER(JSON_UNQUOTE(JSON_EXTRACT(value_json,'$.name'))) ASC",
  );
  return next;
}
