-- 022_buste.sql
-- La cassaforte, seconda parte (SPEC-ospite-e-cassaforte.md R6, §6-bis): le
-- tabelle con contenuto che NON sono giornate ricevono una colonna `busta`.
-- Il contenuto viene chiuso a chiave sul dispositivo e messo li; le colonne
-- di testo di prima restano (vuote per le righe nuove) perche le righe
-- scritte prima della cassaforte si leggono ancora da li finche la persona
-- non le porta nella cassaforte (R12).
--
-- Dove il contenuto faceva da chiave di unicita (fact_aliases.alias,
-- open_questions.soggetto_key, day_exclusions.label_key) al suo posto va
-- l'IMPRONTA (HMAC-SHA256 con la chiave del diario, esadecimale): stesso
-- testo, stessa impronta, quindi l'unicita regge; senza la chiave non dice
-- niente. La colonna e la stessa: cambia cio che ci si scrive.
--
-- Restano in chiaro, di proposito: remembers.kind (serve al filtro "solo le
-- persone" del glossario), recaps.period_*, open_questions.entry_date /
-- azione / specie, il fatto che una domanda abbia o no una risposta
-- (risposta not null: e un marcatore, il testo vero sta nella busta).

set search_path = public;

alter table remembers add column if not exists busta text;
alter table recaps add column if not exists busta text;
alter table open_questions add column if not exists busta text;
alter table fact_aliases add column if not exists busta text;
alter table day_exclusions add column if not exists busta text;
