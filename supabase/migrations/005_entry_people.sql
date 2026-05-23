-- 005_entry_people.sql
-- Add a denormalized people column to entries: a jsonb array of person names
-- related to that day (mentioned in the transcript). Display source for the
-- Social section on the Day view. The canonical person records still live in
-- the remembers table (kind = 'persona'); this is just the per-day link.

set search_path = public;

alter table entries
  add column if not exists people jsonb not null default '[]'::jsonb;
