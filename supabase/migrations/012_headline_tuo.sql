-- 012_headline_tuo.sql
--
-- Il titolo scritto a mano non si tocca piu (decisione di Manuel, 22 agosto
-- 2026).
--
-- Perche serve una colonna e non basta un confronto. Si potrebbe pensare di
-- capirlo da soli - "se il titolo e diverso da quello che genererebbe l'AI,
-- allora l'ha scritto lui" - ma l'AI genera un titolo diverso ogni volta che
-- rilegge, quindi quel confronto direbbe "l'ha scritto lui" sempre. L'unica
-- cosa che il codice non puo dedurre e L'INTENZIONE: questa colonna la
-- registra nel momento in cui c'e, cioe quando l'utente preme salva.
--
-- Vale finche l'utente non cancella la giornata. Non c'e strada indietro
-- dall'app: se scrivi il titolo, e tuo (scelta esplicita, opzione 2 del
-- mockup titolo-riassunto-luoghi.html).

set search_path = public;

alter table public.entries
  add column if not exists headline_locked boolean not null default false;

comment on column public.entries.headline_locked is
  'true = il titolo lo ha scritto l''utente: nessuna rielaborazione AI lo sovrascrive.';
