export type D1Database = any;
export type PagesFunction<E = any> = (context: { request: Request; env: E }) => Response | Promise<Response>;

export type Env = {
  DB: D1Database;
};

export function nowIso() {
  return new Date().toISOString();
}

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function parseJson(value: any, fallback: any) {
  if (!value) return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function boolToInt(value: any) {
  return value ? 1 : 0;
}

export function flagFromDb(value: any) {
  if (typeof value === "number") return value !== 0;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized !== "" && normalized !== "0" && normalized !== "false" && normalized !== "no";
  }
  return !!value;
}

export function normalizeDevice(row: any) {
  if (!row) return row;
  return {
    ...row,
    is_active: flagFromDb(row.is_active),
    is_online: flagFromDb(row.is_online),
    is_permanent: flagFromDb(row.is_permanent),
    reported_lists: parseJson(row.reported_lists, []),
  };
}

export function normalizeList(row: any) {
  if (!row) return row;
  return { ...row, is_active: flagFromDb(row.is_active) };
}

export async function getOrCreateDevice(db: D1Database, payload: any) {
  const deviceCode = String(payload.device_code || "").trim();
  if (!deviceCode) throw new Error("Falta device_code");

  const existing = await db
    .prepare("select * from devices where device_code = ? limit 1")
    .bind(deviceCode)
    .first();

  const now = nowIso();
  if (existing) {
    await db
      .prepare(
        "update devices set display_code = coalesce(?, display_code), device_name = coalesce(?, device_name), app_version = coalesce(?, app_version), last_seen = ?, heartbeat_at = coalesce(heartbeat_at, ?) where id = ?"
      )
      .bind(
        payload.display_code || null,
        payload.device_name || null,
        payload.app_version || null,
        now,
        now,
        existing.id
      )
      .run();
    return normalizeDevice({ ...existing, ...payload, last_seen: now });
  }

  const id = crypto.randomUUID();
  await db
    .prepare(
      "insert into devices (id, created_at, device_code, display_code, device_name, platform, app_version, is_active, is_online, last_seen, heartbeat_at) values (?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?)"
    )
    .bind(
      id,
      now,
      deviceCode,
      payload.display_code || null,
      payload.device_name || null,
      payload.platform || null,
      payload.app_version || null,
      now,
      now
    )
    .run();

  return normalizeDevice(await db.prepare("select * from devices where id = ?").bind(id).first());
}

export async function getAssignedActiveLists(db: D1Database, deviceId: string) {
  const rows = await db
    .prepare(
      "select l.* from device_list_assignments a join xtream_lists l on l.id = a.xtream_list_id where a.device_id = ? order by l.created_at desc"
    )
    .bind(deviceId)
    .all();

  return rows.results.map((row: any) => normalizeList(row));
}
