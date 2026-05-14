create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  discord_id text unique,
  discord_username text,
  display_name text,
  avatar_url text,
  timezone text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inventory_locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  system text,
  location_type text,
  parent_location_id uuid,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  constraint inventory_locations_parent_owner_fk
    foreign key (parent_location_id, user_id)
    references public.inventory_locations(id, user_id)
    on delete set null
);

create table public.inventory_stacks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  location_id uuid,
  material_id text,
  material_name text,
  item_name text not null,
  item_kind text,
  catalog_item_id text,
  catalog_source text,
  unit_type text,
  quantity numeric(14, 4) not null default 0 check (quantity >= 0),
  quality numeric(10, 4),
  quality_band integer,
  rarity text,
  container text,
  notes text,
  source text,
  source_history jsonb not null default '[]'::jsonb,
  value_auec numeric(14, 2),
  value_unit text,
  value_source text,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  constraint inventory_stacks_location_owner_fk
    foreign key (location_id)
    references public.inventory_locations(id)
    on delete set null
);

create table public.inventory_import_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  source text not null,
  status text not null default 'pending',
  file_name text,
  imported_count integer not null default 0 check (imported_count >= 0),
  skipped_count integer not null default 0 check (skipped_count >= 0),
  error_count integer not null default 0 check (error_count >= 0),
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.inventory_import_rows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  import_run_id uuid not null,
  inventory_stack_id uuid,
  row_index integer not null check (row_index >= 0),
  status text not null default 'pending',
  raw_data jsonb not null default '{}'::jsonb,
  normalized_data jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_import_rows_run_owner_fk
    foreign key (import_run_id, user_id)
    references public.inventory_import_runs(id, user_id)
    on delete cascade,
  constraint inventory_import_rows_stack_owner_fk
    foreign key (inventory_stack_id)
    references public.inventory_stacks(id)
    on delete set null
);

create table public.build_queue_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  recipe_id text not null,
  blueprint_id text,
  item_id text,
  item_name text,
  quantity integer not null default 1 check (quantity > 0),
  status text not null default 'queued',
  priority integer not null default 0,
  priority_active boolean not null default false,
  allow_lower_quality boolean not null default false,
  final_product_quality_band numeric(10, 4),
  final_product_quality_average numeric(10, 4),
  final_product_rarity text,
  material_requirements jsonb not null default '[]'::jsonb,
  reserved_allocations jsonb not null default '[]'::jsonb,
  blueprint_sources jsonb not null default '[]'::jsonb,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.favorite_locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  location_key text not null,
  display_name text not null,
  source text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, location_key)
);

create table public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index inventory_locations_user_id_idx on public.inventory_locations(user_id);
create index inventory_locations_parent_location_id_idx on public.inventory_locations(parent_location_id);
create index inventory_stacks_user_id_idx on public.inventory_stacks(user_id);
create index inventory_stacks_location_id_idx on public.inventory_stacks(location_id);
create index inventory_stacks_material_id_idx on public.inventory_stacks(material_id);
create index inventory_import_runs_user_id_idx on public.inventory_import_runs(user_id);
create index inventory_import_rows_user_id_idx on public.inventory_import_rows(user_id);
create index inventory_import_rows_import_run_id_idx on public.inventory_import_rows(import_run_id);
create index build_queue_items_user_id_idx on public.build_queue_items(user_id);
create index build_queue_items_recipe_id_idx on public.build_queue_items(recipe_id);
create index favorite_locations_user_id_idx on public.favorite_locations(user_id);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger inventory_locations_set_updated_at
before update on public.inventory_locations
for each row execute function public.set_updated_at();

create trigger inventory_stacks_set_updated_at
before update on public.inventory_stacks
for each row execute function public.set_updated_at();

create trigger inventory_import_runs_set_updated_at
before update on public.inventory_import_runs
for each row execute function public.set_updated_at();

create trigger inventory_import_rows_set_updated_at
before update on public.inventory_import_rows
for each row execute function public.set_updated_at();

create trigger build_queue_items_set_updated_at
before update on public.build_queue_items
for each row execute function public.set_updated_at();

create trigger favorite_locations_set_updated_at
before update on public.favorite_locations
for each row execute function public.set_updated_at();

create trigger user_settings_set_updated_at
before update on public.user_settings
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.inventory_locations enable row level security;
alter table public.inventory_stacks enable row level security;
alter table public.inventory_import_runs enable row level security;
alter table public.inventory_import_rows enable row level security;
alter table public.build_queue_items enable row level security;
alter table public.favorite_locations enable row level security;
alter table public.user_settings enable row level security;

create policy "profiles_own_rows"
on public.profiles
for all
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "inventory_locations_own_rows"
on public.inventory_locations
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "inventory_stacks_own_rows"
on public.inventory_stacks
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "inventory_import_runs_own_rows"
on public.inventory_import_runs
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "inventory_import_rows_own_rows"
on public.inventory_import_rows
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "build_queue_items_own_rows"
on public.build_queue_items
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "favorite_locations_own_rows"
on public.favorite_locations
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "user_settings_own_rows"
on public.user_settings
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
