-- Run this in your Supabase SQL editor

-- Tracks table
create table if not exists tracks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  music_url text not null,
  anon_user_id uuid not null,
  play_count int default 0,
  guess_count int default 0,
  revealed boolean default false,
  tpuf_vector_id text
);

-- Guesses table
create table if not exists guesses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  track_id uuid references tracks(id) on delete cascade,
  guesser_id text not null,
  guess_text text not null,
  similarity_score float default 0,
  specificity_score float default 0,
  consensus_score float default 0,
  discovery_rank int default 1,
  overall_score float default 0
);

-- Indexes
create index if not exists guesses_track_id_idx on guesses(track_id);
create index if not exists guesses_similarity_idx on guesses(track_id, similarity_score desc);
create index if not exists tracks_created_at_idx on tracks(created_at desc);

-- Storage bucket for audio
insert into storage.buckets (id, name, public)
values ('audio', 'audio', true)
on conflict do nothing;

-- RLS: allow public read on tracks and guesses
alter table tracks enable row level security;
alter table guesses enable row level security;

create policy "Public read tracks" on tracks for select using (true);
create policy "Public insert tracks" on tracks for insert with check (true);
create policy "Public update tracks" on tracks for update using (true);

create policy "Public read guesses" on guesses for select using (true);
create policy "Public insert guesses" on guesses for insert with check (true);

-- Storage policy: allow public read
create policy "Public read audio" on storage.objects
  for select using (bucket_id = 'audio');

create policy "Public upload audio" on storage.objects
  for insert with check (bucket_id = 'audio');
