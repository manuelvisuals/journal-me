-- Contatore dei consumi AI (19 ago 2026, richiesta di Manuel).
-- Una riga per ogni chiamata OpenAI riuscita, coi token UFFICIALI
-- riportati dal campo usage della risposta. Scrive solo il service role
-- (nessuna policy di insert); l'utente legge le proprie righe.

create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  route text not null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  audio_seconds numeric,
  created_at timestamptz not null default now()
);

alter table public.ai_usage enable row level security;

drop policy if exists "read own ai usage" on public.ai_usage;

create policy "read own ai usage" on public.ai_usage
  for select using (auth.uid() = user_id);

create index if not exists ai_usage_user_created
  on public.ai_usage (user_id, created_at desc);
