alter table public.devices
add column if not exists reported_lists jsonb,
add column if not exists reported_lists_count integer default 0,
add column if not exists reported_lists_updated_at timestamptz;
