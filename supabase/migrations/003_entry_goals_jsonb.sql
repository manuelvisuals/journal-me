-- 003_entry_goals_jsonb.sql
-- Add a denormalized goals_on column to entries: a jsonb array of goal labels
-- that were "on" for that day. This is a pragmatic MVP shortcut over the
-- entry_goals join table (which we keep for future normalization).

set search_path = public;

alter table entries
  add column if not exists goals_on jsonb not null default '[]'::jsonb;
