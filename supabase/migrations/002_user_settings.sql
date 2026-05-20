-- 002_user_settings.sql
-- Per-user settings, starting with the glossary of recurring proper names
-- to inject into the OpenAI Realtime transcription prompt.

set search_path = public;

create table user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  glossary jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create trigger user_settings_set_updated_at
  before update on user_settings
  for each row execute function set_updated_at();

alter table user_settings enable row level security;

create policy "user_settings_select_own" on user_settings
  for select using (auth.uid() = user_id);
create policy "user_settings_insert_own" on user_settings
  for insert with check (auth.uid() = user_id);
create policy "user_settings_update_own" on user_settings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_settings_delete_own" on user_settings
  for delete using (auth.uid() = user_id);
