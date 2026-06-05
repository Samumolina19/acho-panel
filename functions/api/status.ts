import { getOrCreateDevice, json, nowIso, boolToInt, type Env, type PagesFunction } from "./_shared";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const payload = await request.json();
    const device = await getOrCreateDevice(env.DB, payload);
    const now = nowIso();

    await env.DB
      .prepare(
        `update devices set
          current_channel = ?,
          current_content_type = ?,
          current_updated_at = ?,
          is_online = ?,
          playback_state = ?,
          app_state = ?,
          app_version = coalesce(?, app_version),
          display_code = coalesce(?, display_code),
          last_seen = ?,
          heartbeat_at = ?
        where id = ?`
      )
      .bind(
        nullable(payload.current_channel),
        nullable(payload.current_content_type),
        now,
        boolToInt(payload.is_online !== false),
        nullable(payload.playback_state),
        nullable(payload.app_state),
        nullable(payload.app_version),
        nullable(payload.display_code),
        now,
        now,
        device.id
      )
      .run();

    return json({ ok: true });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "Error actualizando estado" }, 500);
  }
};

function nullable(value: any) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text || null;
}
