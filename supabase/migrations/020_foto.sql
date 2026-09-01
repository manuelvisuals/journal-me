-- 020_foto.sql
-- Le foto dal rullino di una giornata (mockup design/mockups/foto-rullino.html,
-- approvato il 1 settembre 2026).
--
-- Due pezzi:
--  1. la tabella entry_photos: una riga per foto, legata al GIORNO (data),
--     non alla giornata scritta — un giorno senza racconto puo avere foto,
--     e cancellare il racconto non cancella i ricordi;
--  2. il bucket PRIVATO `foto` in Supabase Storage, dove stanno i file:
--     <utente>/<giorno>/<id>.jpg      la copia da schermo (~2048px)
--     <utente>/<giorno>/<id>.min.jpg  la miniatura (~480px), quella che la
--                                     giornata mostra
--
-- Le regole RLS sono le stesse di tutto il resto: ognuno vede e tocca solo
-- le proprie righe, e nel bucket solo la propria cartella (il primo
-- segmento del percorso e l'id utente).

set search_path = public;

create table if not exists entry_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  taken_at timestamptz not null default now(),
  w int not null default 0,
  h int not null default 0,
  bytes int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists entry_photos_user_day on entry_photos (user_id, day);

alter table entry_photos enable row level security;

create policy "entry_photos_select_own" on entry_photos
  for select using (auth.uid() = user_id);
create policy "entry_photos_insert_own" on entry_photos
  for insert with check (auth.uid() = user_id);
create policy "entry_photos_delete_own" on entry_photos
  for delete using (auth.uid() = user_id);

-- Il bucket privato. L'insert e idempotente: rieseguire il file non fa danni.
insert into storage.buckets (id, name, public)
  values ('foto', 'foto', false)
  on conflict (id) do nothing;

create policy "foto_select_own" on storage.objects
  for select using (
    bucket_id = 'foto'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "foto_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'foto'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "foto_delete_own" on storage.objects
  for delete using (
    bucket_id = 'foto'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
