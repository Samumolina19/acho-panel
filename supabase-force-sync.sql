alter table public.devices
add column if not exists sync_requested_at timestamptz,
add column if not exists last_forced_sync_at timestamptz;
