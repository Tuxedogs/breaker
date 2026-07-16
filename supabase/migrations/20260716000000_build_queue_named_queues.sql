begin;

create table public.build_queues (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  source_type text not null default 'custom' check (source_type in ('custom', 'fitting')),
  source_reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index build_queues_user_id_idx on public.build_queues(user_id);
create index build_queues_source_reference_idx on public.build_queues(user_id, source_type, source_reference);

alter table public.build_queue_items add column queue_id uuid;

insert into public.build_queues (user_id, name, source_type)
select distinct user_id, 'Default Queue', 'custom'
from public.build_queue_items;

update public.build_queue_items as item
set queue_id = queue.id
from public.build_queues as queue
where queue.user_id = item.user_id
  and queue.name = 'Default Queue'
  and queue.source_type = 'custom'
  and item.queue_id is null;

alter table public.build_queue_items
  alter column queue_id set not null,
  add constraint build_queue_items_queue_id_fkey
    foreign key (queue_id) references public.build_queues(id) on delete cascade;

create index build_queue_items_queue_id_idx on public.build_queue_items(queue_id);

create trigger build_queues_set_updated_at
before update on public.build_queues
for each row execute function public.set_updated_at();

alter table public.build_queues enable row level security;

create policy "build_queues_own_rows"
on public.build_queues
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

commit;
