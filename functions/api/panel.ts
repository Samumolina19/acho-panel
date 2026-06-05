type D1Database = any;
type PagesFunction<E = any> = (context: { request: Request; env: E }) => Response | Promise<Response>;

type Env = {
  DB: D1Database;
  PANEL_ACCESS_CODE?: string;
  NEXT_PUBLIC_PANEL_ACCESS_CODE?: string;
};

const TABLES = {
  devices: [
    "custom_alias",
    "expires_at",
    "is_permanent",
    "is_active",
    "is_online",
    "current_channel",
    "current_content_type",
    "current_updated_at",
    "last_seen",
    "heartbeat_at",
    "playback_state",
    "app_state",
    "app_version",
    "vpn_config",
    "vpn_config_updated_at",
    "sync_requested_at",
    "last_forced_sync_at",
    "reported_lists",
    "reported_lists_count",
    "reported_lists_updated_at",
  ],
  xtream_lists: ["alias", "server", "username", "password", "is_active"],
  device_list_assignments: ["device_id", "xtream_list_id"],
  app_config: ["latest_version_code", "latest_version_name", "apk_url", "release_notes", "updated_at"],
} as const;

const DELETE_WHERE = {
  devices: ["id"],
  xtream_lists: ["id"],
  device_list_assignments: ["id", "device_id", "xtream_list_id"],
  app_config: ["id"],
} as const;

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body = await request.json();
    assertPanelAccess(request, env, body?.panelCode);

    switch (body?.action) {
      case "snapshot":
        return json(await getSnapshot(env.DB));
      case "insert":
        return json({ data: await insertRows(env.DB, body.table, body.rows ?? body.row) });
      case "update":
        await updateRow(env.DB, body.table, body.id, body.patch);
        return json({ ok: true });
      case "delete":
        await deleteRows(env.DB, body.table, body.where);
        return json({ ok: true });
      case "replace-device":
        await replaceDevice(env.DB, body.sourceDeviceId, body.targetDeviceId, true);
        return json({ ok: true });
      case "copy-device":
        await replaceDevice(env.DB, body.sourceDeviceId, body.targetDeviceId, false);
        return json({ ok: true });
      default:
        return json({ error: "Acción no válida" }, 400);
    }
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Error del panel" }, 500);
  }
};

function assertPanelAccess(request: Request, env: Env, panelCode?: string) {
  const expected = (env.PANEL_ACCESS_CODE || env.NEXT_PUBLIC_PANEL_ACCESS_CODE || "1208").trim();
  const received = (panelCode || request.headers.get("x-panel-code") || "").trim();
  if (expected && received !== expected) {
    throw new Error("Código de panel incorrecto");
  }
}

async function getSnapshot(db: D1Database) {
  const [devices, lists, assignments, appConfig] = await Promise.all([
    db.prepare("select * from devices order by created_at desc").all(),
    db.prepare("select * from xtream_lists order by created_at desc").all(),
    db.prepare("select * from device_list_assignments order by created_at desc").all(),
    db.prepare("select * from app_config where id = 'main' limit 1").first(),
  ]);

  return {
    devices: devices.results.map(normalizeDevice),
    lists: lists.results.map(normalizeList),
    assignments: assignments.results,
    appConfig: appConfig ?? null,
  };
}

async function insertRows(db: D1Database, table: keyof typeof TABLES, rowsInput: any) {
  if (!(table in TABLES)) throw new Error("Tabla no permitida");
  const rows = Array.isArray(rowsInput) ? rowsInput : [rowsInput];
  const inserted = [];

  for (const row of rows) {
    const id = row.id || crypto.randomUUID();
    const allowed = TABLES[table];
    const data: Record<string, any> = { id };

    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(row, key)) data[key] = encodeValue(key, row[key]);
    }

    const columns = Object.keys(data);
    const placeholders = columns.map(() => "?").join(", ");
    await db
      .prepare(`insert into ${table} (${columns.join(", ")}) values (${placeholders})`)
      .bind(...columns.map((key) => data[key]))
      .run();

    const created = await db.prepare(`select * from ${table} where id = ?`).bind(id).first();
    inserted.push(table === "devices" ? normalizeDevice(created) : table === "xtream_lists" ? normalizeList(created) : created);
  }

  return Array.isArray(rowsInput) ? inserted : inserted[0];
}

async function updateRow(db: D1Database, table: keyof typeof TABLES, id: string, patch: Record<string, any>) {
  if (!(table in TABLES)) throw new Error("Tabla no permitida");
  if (!id) throw new Error("Falta id");

  if (table === "app_config" && id === "main") {
    const existing = await db.prepare("select id from app_config where id = 'main'").first();
    if (!existing) {
      await db.prepare("insert into app_config (id) values ('main')").run();
    }
  }

  const allowed = TABLES[table];
  const entries = Object.entries(patch || {}).filter(([key]) => (allowed as readonly string[]).includes(key));
  if (entries.length === 0) return;

  const setSql = entries.map(([key]) => `${key} = ?`).join(", ");
  await db
    .prepare(`update ${table} set ${setSql} where id = ?`)
    .bind(...entries.map(([key, value]) => encodeValue(key, value)), id)
    .run();
}

async function deleteRows(db: D1Database, table: keyof typeof DELETE_WHERE, where: Record<string, any>) {
  if (!(table in DELETE_WHERE)) throw new Error("Tabla no permitida");
  const entries = Object.entries(where || {}).filter(([key]) => (DELETE_WHERE[table] as readonly string[]).includes(key));
  if (entries.length !== 1) throw new Error("Filtro de borrado no válido");
  const [key, value] = entries[0];
  await db.prepare(`delete from ${table} where ${key} = ?`).bind(value).run();
}

async function replaceDevice(db: D1Database, sourceDeviceId: string, targetDeviceId: string, removeSource: boolean) {
  if (!sourceDeviceId || !targetDeviceId || sourceDeviceId === targetDeviceId) {
    throw new Error("Dispositivos no válidos");
  }

  const source = await db.prepare("select * from devices where id = ?").bind(sourceDeviceId).first();
  if (!source) throw new Error("Dispositivo origen no encontrado");

  await updateRow(db, "devices", targetDeviceId, {
    custom_alias: removeSource ? source.custom_alias : undefined,
    expires_at: source.expires_at,
    is_permanent: source.is_permanent,
    is_active: source.is_active,
    vpn_config: source.vpn_config,
    vpn_config_updated_at: source.vpn_config ? source.vpn_config_updated_at || new Date().toISOString() : null,
  });

  await db.prepare("delete from device_list_assignments where device_id = ?").bind(targetDeviceId).run();
  const assignments = await db
    .prepare("select xtream_list_id from device_list_assignments where device_id = ?")
    .bind(sourceDeviceId)
    .all();

  for (const assignment of assignments.results) {
    await insertRows(db, "device_list_assignments", {
      device_id: targetDeviceId,
      xtream_list_id: assignment.xtream_list_id,
    });
  }

  if (removeSource) {
    await db.prepare("delete from device_list_assignments where device_id = ?").bind(sourceDeviceId).run();
    await db.prepare("delete from devices where id = ?").bind(sourceDeviceId).run();
  }
}

function normalizeDevice(row: any) {
  if (!row) return row;
  return {
    ...row,
    is_active: !!row.is_active,
    is_online: !!row.is_online,
    is_permanent: !!row.is_permanent,
    reported_lists: parseJson(row.reported_lists, []),
  };
}

function normalizeList(row: any) {
  if (!row) return row;
  return { ...row, is_active: !!row.is_active };
}

function encodeValue(key: string, value: any) {
  if (value === undefined) return null;
  if (["is_active", "is_online", "is_permanent"].includes(key)) return value ? 1 : 0;
  if (key === "reported_lists") return typeof value === "string" ? value : JSON.stringify(value ?? []);
  return value ?? null;
}

function parseJson(value: any, fallback: any) {
  if (!value) return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
