-- 017_profile_name.sql
-- Il nome mostrato (mockup design/mockups/nome-profilo.html, scelto da
-- Manuel il 28 agosto 2026: pennina in linea sul computer, pennina nel menu
-- sul telefono).
--
-- PERCHE SERVE. Il nome che l'app mostra oggi non l'ha scelto nessuno: e
-- l'email tagliata alla chiocciola. Chi si chiama Manuel e ha un indirizzo
-- come madh52@gmail.com viene chiamato "madh52" dalla sua stessa app, e non
-- esiste nessun posto dove correggerlo.
--
-- STESSE REGOLE DELLA 016. La colonna sta nella riga del profilo (che il
-- client legge gia per il piano e per la foto: nessuna richiesta in piu), e
-- NON si aggiunge nessuna policy di update — `profiles` contiene anche
-- `plan`, e in Postgres le policy valgono per riga e non per colonna: dare
-- l'update all'utente vorrebbe dire dargli il premium. La scrittura passa
-- dal service role, in src/modules/impostazioni/server/nome.ts.

set search_path = public;

alter table public.profiles
  add column if not exists display_name text,
  add column if not exists display_name_updated_at timestamptz;

-- Trenta caratteri: la rail destra e larga 296px e a 15px in semigrassetto
-- oltre quella misura il nome verrebbe tagliato con i puntini. Il limite
-- vive anche nel client (NOME_MAX in profilo-contract.ts), ma un limite che
-- si vede solo nel client non e un limite.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_display_name_size'
  ) then
    alter table public.profiles
      add constraint profiles_display_name_size
      check (display_name is null or char_length(display_name) between 1 and 30);
  end if;
end $$;

comment on column public.profiles.display_name is
  'Nome scelto dall''utente. null = si ricade sull''email tagliata alla chiocciola. Scritto solo dal service role via /api/account/nome.';
