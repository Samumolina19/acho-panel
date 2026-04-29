alter table public.devices
add column if not exists vpn_config text,
add column if not exists vpn_config_updated_at timestamptz;

