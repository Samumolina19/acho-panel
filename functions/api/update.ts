import { json, type Env, type PagesFunction } from "./_shared";

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  try {
    const row = await env.DB.prepare("select * from app_config where id = 'main' limit 1").first();

    return json({
      latest_version_code: Number(row?.latest_version_code || 0),
      latest_version_name: row?.latest_version_name || "",
      apk_url: row?.apk_url || "",
      release_notes: row?.release_notes || "",
      updated_at: row?.updated_at || "",
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Error leyendo actualizacion" }, 500);
  }
};
