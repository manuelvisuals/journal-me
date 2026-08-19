-- 007_user_settings_theme.sql
-- Tema e appearance seguono l'account sul cloud (SPEC-temi §5): la scelta
-- vive in localStorage (l'unica cosa che il boot script legge in modo
-- sincrono) e in piu qui, cosi un nuovo dispositivo parte gia col tema
-- giusto. Il client scrive best-effort: se questa migration non e ancora
-- applicata, l'upsert fallisce in silenzio e non rompe niente.

set search_path = public;

alter table public.user_settings
  add column if not exists theme text,
  add column if not exists appearance text
    check (appearance in ('light', 'dark', 'system'));
