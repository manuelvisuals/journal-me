-- 016_profile_avatar.sql
-- La foto profilo (mockup design/mockups/foto-profilo-flusso.html, approvato
-- da Manuel il 28 agosto 2026).
--
-- PERCHE DENTRO LA RIGA E NON IN UN BUCKET. Un avatar mostrato a 44px e un
-- quadrato da 256px: ritagliato nel telefono e salvato in JPEG diventa ~10 KB,
-- cioe ~14 KB in base64. Per quella taglia un deposito file (Supabase Storage)
-- vorrebbe dire un bucket, le sue policy, gli URL firmati e un pezzo di
-- infrastruttura in piu da ricordare per sempre: piu superficie di quanta ne
-- risparmi. Tenendola qui, la foto viaggia con la riga che il client legge gia,
-- e sparisce DA SOLA quando l'account viene eliminato (la 006 ha
-- `on delete cascade` verso auth.users) — senza che delete-account.ts debba
-- sapere che esistono le immagini.
--
-- PERCHE NESSUNA POLICY DI UPDATE. Questa tabella contiene anche `plan`. Dare
-- all'utente il permesso di aggiornare la propria riga vorrebbe dire dargli il
-- permesso di scriversi `plan = 'premium'`: le policy di Postgres valgono per
-- RIGA, non per colonna. Quindi la 006 resta com'e (solo lettura della propria
-- riga) e la scrittura passa dal service role, in
-- src/modules/impostazioni/server/avatar.ts, che scrive SOLO queste due
-- colonne e solo per l'utente che ha presentato il token.

set search_path = public;

alter table public.profiles
  add column if not exists avatar_data text,
  add column if not exists avatar_updated_at timestamptz;

-- Il tetto: ~64 KB di base64, cioe circa 48 KB di immagine. Il client manda
-- 256px in JPEG (~14 KB); questo vincolo esiste per il caso in cui un domani
-- qualcuno cambi i parametri del ritaglio senza accorgersi che la riga del
-- profilo viene letta a ogni avvio. Un limite che si vede nello schema e piu
-- onesto di un limite scritto solo nel client.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_avatar_data_size'
  ) then
    alter table public.profiles
      add constraint profiles_avatar_data_size
      check (avatar_data is null or length(avatar_data) <= 65536);
  end if;
end $$;

comment on column public.profiles.avatar_data is
  'Foto profilo come data URL (image/jpeg base64), 256x256. Scritta solo dal service role via /api/account/avatar.';
