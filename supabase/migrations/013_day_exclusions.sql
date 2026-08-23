-- Le cose che quel giorno NON c'entrano (23 agosto 2026).
--
-- Richiesta di Manuel: "se menziono una persona ma non l'ho incontrata, non
-- deve andare li". Nel racconto Marco c'e — magari hai scritto "dovevo
-- vedere Marco ma ha annullato" — e l'AI lo legge, giustamente, perche il
-- nome e nel testo.
--
-- PERCHE UNA TABELLA E NON UNA CANCELLAZIONE. Le persone e i luoghi di una
-- giornata si ricalcolano da zero a ogni modifica del testo (regola del 21
-- agosto: il racconto e re). Togliere Marco dall'elenco salvato durerebbe
-- fino alla prossima riga aggiunta, e poi tornerebbe: un bottone che sembra
-- funzionare e si disfa da solo e peggio di un bottone che non c'e.
-- Qui invece resta scritto che quel giorno Marco non c'entra, e la rilettura
-- del testo non lo sa e non lo tocca.
--
-- PERCHE PER GIORNO E NON PER SEMPRE. "Non l'ho incontrato" riguarda quel
-- giorno. Domani Marco potresti vederlo davvero, e sarebbe assurdo doverlo
-- riabilitare. E la stessa distinzione dei chiarimenti: identita per sempre,
-- episodio per quella giornata (src/app/api/chiarimenti/route.ts).
--
-- label_key e la forma normalizzata (minuscola, senza accenti): "Marco" e
-- "marco" sono la stessa persona, e chi toglie l'una toglie l'altra.

set search_path = public;

create table if not exists public.day_exclusions (
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_date date not null,
  kind text not null
    check (kind in ('cibo', 'attivita', 'persona', 'lavoro', 'luogo')),
  label_key text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, entry_date, kind, label_key)
);

alter table public.day_exclusions enable row level security;

create policy "day_exclusions: read own" on public.day_exclusions
  for select using (auth.uid() = user_id);
create policy "day_exclusions: insert own" on public.day_exclusions
  for insert with check (auth.uid() = user_id);
create policy "day_exclusions: delete own" on public.day_exclusions
  for delete using (auth.uid() = user_id);

-- La lettura vera e sempre "cosa e escluso in QUESTO giorno".
create index if not exists day_exclusions_user_date_idx
  on public.day_exclusions (user_id, entry_date);
