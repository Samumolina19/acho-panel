create table if not exists devices (
  id text primary key,
  created_at text not null default (datetime('now')),
  device_code text unique,
  display_code text,
  device_name text,
  custom_alias text,
  platform text,
  app_version text,
  is_active integer not null default 0,
  is_online integer not null default 0,
  current_channel text,
  current_content_type text,
  current_updated_at text,
  last_seen text,
  heartbeat_at text,
  playback_state text,
  app_state text,
  expires_at text,
  is_permanent integer not null default 0,
  vpn_config text,
  vpn_config_updated_at text,
  sync_requested_at text,
  last_forced_sync_at text,
  reported_lists text,
  reported_lists_count integer not null default 0,
  reported_lists_updated_at text
);

create table if not exists xtream_lists (
  id text primary key,
  created_at text not null default (datetime('now')),
  alias text not null,
  server text not null,
  username text not null,
  password text not null,
  is_active integer not null default 1
);

create table if not exists device_list_assignments (
  id text primary key,
  created_at text not null default (datetime('now')),
  device_id text not null,
  xtream_list_id text not null,
  foreign key (device_id) references devices(id) on delete cascade,
  foreign key (xtream_list_id) references xtream_lists(id) on delete cascade
);

create unique index if not exists idx_assignments_unique
  on device_list_assignments(device_id, xtream_list_id);

create index if not exists idx_devices_device_code on devices(device_code);
create index if not exists idx_assignments_device on device_list_assignments(device_id);
create index if not exists idx_assignments_list on device_list_assignments(xtream_list_id);
create index if not exists idx_lists_key on xtream_lists(server, username);

create table if not exists app_config (
  id text primary key,
  latest_version_code integer,
  latest_version_name text,
  apk_url text,
  release_notes text,
  updated_at text
);

insert into app_config (
  id,
  latest_version_code,
  latest_version_name,
  apk_url,
  release_notes,
  updated_at
)
values ('main', 1, '1.0', '', '', datetime('now'))
on conflict(id) do nothing;
