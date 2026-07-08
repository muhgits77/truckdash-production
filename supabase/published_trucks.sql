-- =============================================================================
-- TruckDash · published_trucks
-- Paste this into Supabase Dashboard → SQL Editor → Run
-- Project: TruckDash (use a separate project for Cluckin Chaos if needed)
-- =============================================================================

-- 1) Table -------------------------------------------------------------------
create table if not exists public.published_trucks (
  id uuid primary key default gen_random_uuid(),

  -- Stable public id for this truck (e.g. "bluegrass-kitchen", "cluckin-chaos")
  truck_id text not null unique,

  -- Owner who published (must match auth.uid() for writes)
  user_id uuid references auth.users (id) on delete set null,

  -- Columns mirrored from PublishedPayload (app shape)
  truck_name text not null default '',
  phone text not null default '',
  order_url text not null default '',
  location text not null default '',
  hours_start text not null default '',
  hours_end text not null default '',
  special text not null default '',
  menu jsonb not null default '[]'::jsonb,
  schedule jsonb not null default '[]'::jsonb,
  last_published timestamptz not null default now(),
  version int not null default 1,

  -- Full snapshot for forward-compat / external sites
  payload jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One "current" row per truck (upsert on truck_id). History can be added later.
create index if not exists published_trucks_last_published_idx
  on public.published_trucks (last_published desc);

-- Keep updated_at fresh
create or replace function public.set_published_trucks_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists published_trucks_updated_at on public.published_trucks;
create trigger published_trucks_updated_at
  before update on public.published_trucks
  for each row execute function public.set_published_trucks_updated_at();

-- 2) RLS ---------------------------------------------------------------------
alter table public.published_trucks enable row level security;

-- Public / anonymous: read any published truck (needed for /website, /menu, etc.)
drop policy if exists "Public can read published trucks" on public.published_trucks;
create policy "Public can read published trucks"
  on public.published_trucks
  for select
  to anon, authenticated
  using (true);

-- Authenticated owners: insert only their own rows
drop policy if exists "Owners can insert own published trucks" on public.published_trucks;
create policy "Owners can insert own published trucks"
  on public.published_trucks
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Authenticated owners: update only their own rows
drop policy if exists "Owners can update own published trucks" on public.published_trucks;
create policy "Owners can update own published trucks"
  on public.published_trucks
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Authenticated owners: optional delete of own rows
drop policy if exists "Owners can delete own published trucks" on public.published_trucks;
create policy "Owners can delete own published trucks"
  on public.published_trucks
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- 3) Optional: quick test row (run AFTER you have a user, replace UUIDs)
-- insert into public.published_trucks (truck_id, user_id, truck_name, special, payload)
-- values (
--   'bluegrass-kitchen',
--   'YOUR-AUTH-USER-UUID',
--   'Bluegrass Kitchen',
--   'Bourbon-Glazed Pulled Pork Nachos',
--   '{}'::jsonb
-- );
