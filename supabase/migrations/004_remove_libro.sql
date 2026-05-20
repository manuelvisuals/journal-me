-- 004_remove_libro.sql
--
-- Rimuove la categoria 'libro' dal check constraint dei remembers.
-- La sezione Libri e' stata eliminata dall'app per semplificare la
-- tassonomia. Nessuna riga esistente con kind='libro' (verificato),
-- quindi serve solo ricreare il constraint senza 'libro'.
--
-- Idempotente: si puo' rieseguire senza danni.

alter table public.remembers
  drop constraint if exists remembers_kind_check;

alter table public.remembers
  add constraint remembers_kind_check
  check (kind in ('persona', 'todo', 'nota', 'luogo', 'idea'));
