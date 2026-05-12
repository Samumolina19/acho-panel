create table if not exists public.app_config (
  id text primary key,
  latest_version_code integer,
  latest_version_name text,
  apk_url text,
  release_notes text,
  updated_at timestamptz default now()
);

insert into public.app_config (
  id,
  latest_version_code,
  latest_version_name,
  apk_url,
  release_notes
)
values (
  'main',
  1,
  '1.0',
  '',
  ''
)
on conflict (id) do nothing;
