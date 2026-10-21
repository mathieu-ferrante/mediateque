-- Médiathèque : à coller dans Supabase > SQL Editor > New query, puis "Run".

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type text not null check (type in ('film', 'serie', 'jeu', 'livre')),
  title text not null,
  original_title text,
  year int,
  poster_url text,
  overview text,
  genres text[] not null default '{}',
  creator text,                 -- réalisateur, créateur, studio ou auteur
  platforms text[] not null default '{}',
  runtime_min int,              -- durée d'un film / d'un épisode
  total_min int,                -- durée totale estimée (série entière, jeu, livre)
  pages int,
  seasons int,
  episodes int,
  status text not null default 'a_voir'
    check (status in ('a_voir', 'en_cours', 'termine', 'abandonne', 'attendu')),
  rating smallint check (rating between 1 and 10),
  review text,
  progress text,                -- ex : "S2E5", "page 120", "chapitre 4"
  favorite boolean not null default false,
  source text not null default 'manuel',
  source_id text,
  release_date date,
  next_release_date date,
  next_release_label text,
  media_status text,            -- statut côté source : "Ended", "Returning Series"...
  added_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  refreshed_at timestamptz
);

create unique index if not exists items_user_source_uniq
  on public.items (user_id, source, source_id) where source_id is not null;
create index if not exists items_user_status on public.items (user_id, status);

-- Chacun ne voit et ne modifie que ses propres fiches
alter table public.items enable row level security;

drop policy if exists "items_select_own" on public.items;
drop policy if exists "items_insert_own" on public.items;
drop policy if exists "items_update_own" on public.items;
drop policy if exists "items_delete_own" on public.items;
create policy "items_select_own" on public.items for select using (auth.uid() = user_id);
create policy "items_insert_own" on public.items for insert with check (auth.uid() = user_id);
create policy "items_update_own" on public.items for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "items_delete_own" on public.items for delete using (auth.uid() = user_id);

-- updated_at automatique
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists items_touch on public.items;
create trigger items_touch before update on public.items
  for each row execute function public.touch_updated_at();

-- Petite fonction appelée par le "ping" anti-mise en pause (GitHub Actions)
create or replace function public.ping() returns text
language sql security definer set search_path = public as $$ select 'pong'::text $$;
grant execute on function public.ping() to anon, authenticated;
