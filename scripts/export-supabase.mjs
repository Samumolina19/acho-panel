import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const envPath = path.join(root, ".env.local");
const outPath = path.join(root, "supabase-export.json");

const env = readEnv(envPath);
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !anonKey) {
  throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local");
}

const tables = ["devices", "xtream_lists", "device_list_assignments", "app_config"];
const exportData = {};

for (const table of tables) {
  const url = `${supabaseUrl}/rest/v1/${table}?select=*`;
  const response = await fetch(url, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Error exportando ${table}: HTTP ${response.status} ${text}`);
  }

  exportData[table] = text ? JSON.parse(text) : [];
}

fs.writeFileSync(outPath, JSON.stringify(exportData, null, 2), "utf8");
console.log(`Exportacion guardada en ${outPath}`);

function readEnv(filePath) {
  const result = {};
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    result[key] = value;
  }
  return result;
}
