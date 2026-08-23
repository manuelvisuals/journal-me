-- Le domande dell'AI diventano una CODA che vive (23 agosto 2026).
--
-- Fino a ieri una domanda nasceva alla fine di un'analisi, veniva mostrata e
-- moriva li: se saltavi, era persa per sempre. Manuel ha cambiato la regola,
-- e la regola nuova e piu severa: "per ora niente possibilita di skippare
-- domande a vita — puo solo saltarla adesso, ma tanto poi te la rifaro dopo,
-- e le richiede a sfinimento finche l'utente non risponde a tutto".
--
-- Quindi le domande vanno scritte da qualche parte. Qui.
--
-- COME SI LEGGE QUESTA TABELLA. Una riga con `risposta` vuota e una domanda
-- ancora aperta: si ripresenta a ogni analisi, di qualunque giornata, finche
-- non le dai una risposta. Una riga con `risposta` piena e una cosa decisa:
-- resta per dire che quella domanda NON va rifatta.
--
-- PERCHE LE RISPOSTE NON SI CANCELLANO. Senza, una domanda di episodio
-- ("la piscina di oggi era sport o compagnia?") tornerebbe a ogni rilettura
-- del testo, perche il modello la trova ambigua ogni volta — ed e ambigua
-- davvero. Le domande di identita si difendono da sole (una volta chiarito
-- chi e tuo fratello, l'alias basta a non richiederlo), quelle di episodio
-- no: se lo ricordano solo qui.
--
-- soggetto_key e la forma normalizzata, cosi "Mio Fratello" e "mio fratello"
-- sono la stessa domanda e non se ne accumulano due.

set search_path = public;

create table if not exists public.open_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_date date not null,
  specie text not null check (specie in ('identita', 'episodio')),
  azione text not null check (azione in ('persona', 'specie', 'area')),
  soggetto text not null,
  soggetto_key text not null,
  citazione text not null default '',
  testo text not null,
  perche text not null default '',
  opzioni jsonb not null default '[]'::jsonb,
  libero boolean not null default false,
  -- Vuota = ancora da chiedere. Piena = decisa, non si richiede.
  risposta text,
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  -- Una domanda sola per (giornata, azione, soggetto): rileggere lo stesso
  -- testo dieci volte non deve produrre dieci volte lo stesso dubbio.
  unique (user_id, entry_date, azione, soggetto_key)
);

alter table public.open_questions enable row level security;

create policy "open_questions: read own" on public.open_questions
  for select using (auth.uid() = user_id);
create policy "open_questions: insert own" on public.open_questions
  for insert with check (auth.uid() = user_id);
create policy "open_questions: update own" on public.open_questions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "open_questions: delete own" on public.open_questions
  for delete using (auth.uid() = user_id);

-- La lettura vera e sempre "cosa e ancora aperto", su tutto il diario.
create index if not exists open_questions_aperte_idx
  on public.open_questions (user_id, entry_date)
  where risposta is null;
