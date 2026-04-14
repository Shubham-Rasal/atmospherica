-- Mood radio: store the submitted line and optional grid slot.
-- Run via Supabase CLI (`supabase db push`) or paste into SQL Editor → Run.
-- If PostgREST still errors, wait ~30s or use Dashboard → Settings → API → Reload schema.

alter table public.tracks add column if not exists feeling_text text;
alter table public.tracks add column if not exists grid_position int;

comment on column public.tracks.feeling_text is 'User-submitted line that generated this clip';
