-- 010_default_goals.sql
--
-- Rifa la lista dei micro-goal che ogni nuovo utente si trova al primo
-- accesso. Quella di 001_init.sql era la lista personale di Manuel di
-- maggio 2026, scritta come esempio e mai piu toccata: per chiunque non
-- sia lui e imbarazzante, e la prima cosa che vede.
--
-- Criteri della lista nuova, non gusto personale:
--  - FORMULATE AL POSITIVO. I micro-goal sono tracker neutri, non voti
--    (regola del progetto: nessuna vergogna per i giorni spenti). "mosso
--    il corpo" descrive una cosa fatta; "no junkfood" descrive una colpa
--    evitata, e trasforma un diario in una pagella.
--  - UNIVERSALI. Devono funzionare a 25 anni e a 55, per chi lavora e
--    per chi no, per chi vive solo e per chi ha famiglia.
--  - UNA PAROLA CHIAVE CIASCUNO, minuscolo, participio passato: sono
--    caselle che rispondono a "oggi l'ho fatto?".
--  - COPRONO LE QUATTRO AREE che l'AI usa gia per riassumere la
--    giornata (Corpo, Relazioni, Emozioni, Lavoro), senza nominarle.
--
-- Restano comunque modificabili da Impostazioni: questa e solo la
-- lista di partenza. Chi ha gia un account NON viene toccato — questa
-- migration cambia solo cio che succede ai nuovi utenti.
--
-- ATTENZIONE: la stessa lista vive in src/lib/data/store/default-goals.ts
-- per la modalita locale (che non ha trigger Postgres). Le due devono
-- restare identiche.

set search_path = public;

create or replace function seed_default_goals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into goals (user_id, label, position) values
    (new.id, 'mosso il corpo', 0),
    (new.id, 'stato all''aria aperta', 1),
    (new.id, 'dormito abbastanza', 2),
    (new.id, 'visto qualcuno', 3),
    (new.id, 'tempo per me', 4),
    (new.id, 'letto qualcosa', 5);
  return new;
end;
$$;
