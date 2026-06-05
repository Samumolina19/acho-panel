import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const inputPath = path.join(root, "supabase-export.json");
const schemaPath = path.join(root, "cloudflare-d1-schema.sql");
const outputPath = path.join(root, "cloudflare-d1-import.sql");

const data = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const schema = fs.readFileSync(schemaPath, "utf8");

const lines = [
  "-- Import generado para Cloudflare D1.",
  "-- Ejecuta primero este archivo completo en la consola SQL de D1.",
  "PRAGMA foreign_keys = off;",
  schema,
  "begin transaction;",
  "delete from device_list_assignments;",
  "delete from devices;",
  "delete from xtream_lists;",
  "delete from app_config;",
];

appendRows("devices", [
  "id",
  "created_at",
  "device_code",
  "display_code",
  "device_name",
  "custom_alias",
  "platform",
  "app_version",
  "is_active",
  "is_online",
  "current_channel",
  "current_content_type",
  "current_updated_at",
  "last_seen",
  "heartbeat_at",
  "playback_state",
  "app_state",
  "expires_at",
  "is_permanent",
  "vpn_config",
  "vpn_config_updated_at",
  "sync_requested_at",
  "last_forced_sync_at",
  "reported_lists",
  "reported_lists_count",
  "reported_lists_updated_at",
]);

appendRows("xtream_lists", ["id", "created_at", "alias", "server", "username", "password", "is_active"]);
appendRows("device_list_assignments", ["id", "created_at", "device_id", "xtream_list_id"]);
appendRows("app_config", ["id", "latest_version_code", "latest_version_name", "apk_url", "release_notes", "updated_at"]);

lines.push("commit;");
lines.push("PRAGMA foreign_keys = on;");

fs.writeFileSync(outputPath, lines.join("\n") + "\n", "utf8");
console.log(`SQL de importacion guardado en ${outputPath}`);

function appendRows(table, columns) {
  const rows = Array.isArray(data[table]) ? data[table] : [];
  for (const row of rows) {
    const values = columns.map((column) => sqlValue(normalizeValue(column, row[column])));
    lines.push(`insert into ${table} (${columns.join(", ")}) values (${values.join(", ")});`);
  }
}

function normalizeValue(column, value) {
  if (value === undefined) return null;
  if (["is_active", "is_online", "is_permanent"].includes(column)) return value ? 1 : 0;
  if (column === "reported_lists" && value && typeof value !== "string") return JSON.stringify(value);
  return value;
}

function sqlValue(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "null";
  return `'${String(value).replaceAll("'", "''")}'`;
}
