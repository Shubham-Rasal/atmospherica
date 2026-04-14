-- Play order: lower queue_order = earlier in the emotion-ordered rotation.
alter table public.tracks add column if not exists queue_order double precision;

update public.tracks t
set queue_order = sub.rn * 1000000.0
from (
  select id, row_number() over (order by created_at asc) as rn from public.tracks
) sub
where t.id = sub.id
  and t.queue_order is null;

create index if not exists tracks_queue_order_idx on public.tracks (queue_order);

comment on column public.tracks.queue_order is 'Sort key for play queue; placement uses Turbopuffer similarity to neighbors';
