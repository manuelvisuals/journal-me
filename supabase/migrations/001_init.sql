-- 001_init.sql
-- Initial schema for Journal.me.
-- Tables: entries, goals, entry_goals, remembers, recaps.
-- All user-data tables enforce Row Level Security: a user can only access their own rows.

set search_path = public;


-- Helper trigger function: keep updated_at in sync on row updates.
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- =====================
-- entries: one row per day per user
-- =====================
create table entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_date date not null,
  transcript text,
  headline text,
  snippet text,
  areas jsonb not null default '{}'::jsonb,
  mood text,
  weight_kg numeric(5, 2),
  sleep_hours numeric(4, 2),
  sleep_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, entry_date)
);

create index entries_user_date_idx on entries (user_id, entry_date desc);

create trigger entries_set_updated_at
  before update on entries
  for each row execute function set_updated_at();

alter table entries enable row level security;

create policy "entries_select_own" on entries
  for select using (auth.uid() = user_id);
create policy "entries_insert_own" on entries
  for insert with check (auth.uid() = user_id);
create policy "entries_update_own" on entries
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "entries_delete_own" on entries
  for delete using (auth.uid() = user_id);


-- =====================
-- goals: micro-goal definitions per user
-- =====================
create table goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  position int not null default 0,
  is_ai_suggested boolean not null default false,
  created_at timestamptz not null default now()
);

create index goals_user_position_idx on goals (user_id, position);
create unique index goals_user_label_uidx on goals (user_id, lower(label));

alter table goals enable row level security;

create policy "goals_select_own" on goals
  for select using (auth.uid() = user_id);
create policy "goals_insert_own" on goals
  for insert with check (auth.uid() = user_id);
create policy "goals_update_own" on goals
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "goals_delete_own" on goals
  for delete using (auth.uid() = user_id);


-- =====================
-- entry_goals: whether each goal was completed on each entry (many-to-many)
-- =====================
create table entry_goals (
  entry_id uuid not null references entries(id) on delete cascade,
  goal_id uuid not null references goals(id) on delete cascade,
  completed boolean not null default false,
  primary key (entry_id, goal_id)
);

alter table entry_goals enable row level security;

create policy "entry_goals_select_own" on entry_goals
  for select using (
    exists (select 1 from entries e where e.id = entry_id and e.user_id = auth.uid())
  );
create policy "entry_goals_insert_own" on entry_goals
  for insert with check (
    exists (select 1 from entries e where e.id = entry_id and e.user_id = auth.uid())
  );
create policy "entry_goals_update_own" on entry_goals
  for update using (
    exists (select 1 from entries e where e.id = entry_id and e.user_id = auth.uid())
  ) with check (
    exists (select 1 from entries e where e.id = entry_id and e.user_id = auth.uid())
  );
create policy "entry_goals_delete_own" on entry_goals
  for delete using (
    exists (select 1 from entries e where e.id = entry_id and e.user_id = auth.uid())
  );


-- =====================
-- remembers: quick-capture items (people, books, todos, notes)
-- =====================
create table remembers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  kind text not null default 'nota'
    check (kind in ('persona', 'libro', 'todo', 'nota', 'luogo', 'idea')),
  source text not null default 'manual'
    check (source in ('manual', 'extracted')),
  source_entry_id uuid references entries(id) on delete set null,
  created_at timestamptz not null default now()
);

create index remembers_user_created_idx on remembers (user_id, created_at desc);

alter table remembers enable row level security;

create policy "remembers_select_own" on remembers
  for select using (auth.uid() = user_id);
create policy "remembers_insert_own" on remembers
  for insert with check (auth.uid() = user_id);
create policy "remembers_update_own" on remembers
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "remembers_delete_own" on remembers
  for delete using (auth.uid() = user_id);


-- =====================
-- recaps: AI-generated monthly/semester/year recaps
-- =====================
create table recaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_type text not null check (period_type in ('month', 'semester', 'year')),
  period_start date not null,
  period_end date not null,
  title text not null,
  snippet text not null,
  body text not null,
  generated_at timestamptz not null default now(),
  unique (user_id, period_type, period_start)
);

create index recaps_user_period_idx on recaps (user_id, period_start desc);

alter table recaps enable row level security;

create policy "recaps_select_own" on recaps
  for select using (auth.uid() = user_id);
create policy "recaps_insert_own" on recaps
  for insert with check (auth.uid() = user_id);
create policy "recaps_update_own" on recaps
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "recaps_delete_own" on recaps
  for delete using (auth.uid() = user_id);


-- =====================
-- Seed default micro-goals for every new user.
-- Trigger on auth.users insert, runs with security definer to bypass RLS.
-- =====================
create or replace function seed_default_goals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into goals (user_id, label, position) values
    (new.id, 'scopato', 0),
    (new.id, 'no alcol', 1),
    (new.id, 'no junkfood', 2),
    (new.id, 'no sbirciato ex', 3),
    (new.id, 'camminato', 4),
    (new.id, 'visto sunset', 5);
  return new;
end;
$$;

create trigger seed_goals_on_user_create
  after insert on auth.users
  for each row execute function seed_default_goals();
