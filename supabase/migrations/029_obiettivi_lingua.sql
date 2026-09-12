-- 029_obiettivi_lingua.sql (12 settembre 2026)
--
-- Gli obiettivi di fabbrica nascono nella lingua del dispositivo
-- (decisione di Manuel: "O in inglese O in italiano"). Il trigger
-- seed_goals_on_user_create (001, riscritto dalla 010) li seminava in
-- italiano per chiunque alla nascita dell'utente, perche il database non
-- sa che lingua ha il telefono. Da oggi li chiede l'app al primo accesso
-- (POST /api/account/obiettivi-di-fabbrica, modulo impostazioni), e il
-- server segna qui sotto che l'ha fatto: una volta sola per account, anche
-- se poi la persona li cancella tutti.
--
-- Chi esiste gia li ha ricevuti dal trigger: si segna subito, cosi al
-- prossimo accesso non ne riceve altri sei.

set search_path = public;

alter table profiles
  add column if not exists goals_seeded_at timestamptz;

update profiles set goals_seeded_at = now() where goals_seeded_at is null;

drop trigger if exists seed_goals_on_user_create on auth.users;
drop function if exists seed_default_goals();
