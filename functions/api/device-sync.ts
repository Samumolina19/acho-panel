import {
  boolToInt,
  getOrCreateDevice,
  json,
  nowIso,
  parseJson,
  type Env,
  type PagesFunction,
} from "./_shared";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body = await request.json();
    const action = String(body?.action || "").trim();

    switch (action) {
      case "reported-lists":
        return json(await saveReportedLists(env.DB, body));
      case "sync-local-lists":
        return json(await syncLocalLists(env.DB, body));
      case "consume-force-sync":
        return json(await consumeForceSync(env.DB, body));
      default:
        return json({ ok: false, error: "Accion no valida" }, 400);
    }
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "Error de sincronizacion" }, 500);
  }
};

async function saveReportedLists(db: any, body: any) {
  const device = await getOrCreateDevice(db, body);
  const lists = Array.isArray(body.accounts) ? body.accounts : parseJson(body.accounts, []);
  const now = nowIso();

  await db
    .prepare("update devices set reported_lists = ?, reported_lists_count = ?, reported_lists_updated_at = ?, last_seen = ?, heartbeat_at = ? where id = ?")
    .bind(JSON.stringify(lists), lists.length, now, now, now, device.id)
    .run();

  return { ok: true };
}

async function consumeForceSync(db: any, body: any) {
  const device = await getOrCreateDevice(db, body);
  const requestedAt = String(device.sync_requested_at || "").trim();
  const lastForcedAt = String(device.last_forced_sync_at || "").trim();

  if (!requestedAt) return { ok: true, sync: false };

  const requestedTime = Date.parse(requestedAt);
  const lastForcedTime = lastForcedAt ? Date.parse(lastForcedAt) : 0;
  const shouldSync = Number.isFinite(requestedTime) && requestedTime > lastForcedTime;

  if (shouldSync) {
    await db.prepare("update devices set last_forced_sync_at = ? where id = ?").bind(nowIso(), device.id).run();
  }

  return { ok: true, sync: shouldSync };
}

async function syncLocalLists(db: any, body: any) {
  const device = await getOrCreateDevice(db, body);
  const accounts = Array.isArray(body.accounts) ? body.accounts : [];
  const localKeys = new Set(accounts.map((account: any) => listKey(account.server, account.username)));

  for (const account of accounts) {
    const server = clean(account.server);
    const username = clean(account.username);
    const password = clean(account.password);
    if (!server || !username || !password) continue;

    const alias = clean(account.alias) || clean(account.name) || username;
    let list = await db
      .prepare("select * from xtream_lists where lower(server) = lower(?) and lower(username) = lower(?) limit 1")
      .bind(server, username)
      .first();

    if (!list) {
      const id = crypto.randomUUID();
      await db
        .prepare("insert into xtream_lists (id, alias, server, username, password, is_active) values (?, ?, ?, ?, ?, 1)")
        .bind(id, alias, server, username, password)
        .run();
      list = await db.prepare("select * from xtream_lists where id = ?").bind(id).first();
    } else {
      await db
        .prepare("update xtream_lists set alias = ?, server = ?, username = ?, password = ?, is_active = ? where id = ?")
        .bind(alias, server, username, password, boolToInt(account.is_active !== false && account.isActive !== false), list.id)
        .run();
    }

    const existingAssignment = await db
      .prepare("select id from device_list_assignments where device_id = ? and xtream_list_id = ? limit 1")
      .bind(device.id, list.id)
      .first();

    if (!existingAssignment) {
      await db
        .prepare("insert into device_list_assignments (id, device_id, xtream_list_id) values (?, ?, ?)")
        .bind(crypto.randomUUID(), device.id, list.id)
        .run();
    }
  }

  const assignments = await db
    .prepare(
      "select a.id assignment_id, l.id list_id, l.server, l.username from device_list_assignments a join xtream_lists l on l.id = a.xtream_list_id where a.device_id = ?"
    )
    .bind(device.id)
    .all();

  for (const row of assignments.results || []) {
    if (localKeys.has(listKey(row.server, row.username))) continue;
    await db.prepare("delete from device_list_assignments where id = ?").bind(row.assignment_id).run();
    const stillUsed = await db
      .prepare("select id from device_list_assignments where xtream_list_id = ? limit 1")
      .bind(row.list_id)
      .first();
    if (!stillUsed) await db.prepare("delete from xtream_lists where id = ?").bind(row.list_id).run();
  }

  return { ok: true };
}

function clean(value: any) {
  return String(value || "").trim();
}

function listKey(server: string, username: string) {
  return `${clean(server).toLowerCase()}|${clean(username).toLowerCase()}`;
}
