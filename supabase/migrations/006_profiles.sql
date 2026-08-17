-- 006_profiles.sql
-- One row per user with the plan that gates the AI routes (SPEC-v2 §3.2).
-- The user can read their own row; only the service role writes the plan
-- (no insert/update policy on purpose - the Stripe webhook and manual SQL
-- go through the service role, which bypasses RLS).

set search_path = public;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'premium')),
  plan_source text,                        -- 'stripe' | 'manual' | 'apple'
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: read own" on public.profiles
  for select using (auth.uid() = user_id);
-- nessuna policy di insert/update: solo il service role scrive il piano.


-- =====================
-- Seed a 'free' profile for every new user.
-- Same model as seed_default_goals in 001_init.sql: trigger on auth.users
-- insert, security definer to bypass RLS.
-- =====================
create or replace function seed_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger seed_profile_on_user_create
  after insert on auth.users
  for each row execute function seed_profile();


-- Backfill: users that existed before this migration get a 'free' row too,
-- so requirePremium never has to special-case a missing profile.
insert into profiles (user_id)
  select id from auth.users
  on conflict (user_id) do nothing;
