-- 011_facts.sql
--
-- I FATTI: dal racconto ai dati (SPEC-fatti.md §3).
--
-- Perche esiste. Fino a oggi Journal.me sa RACCONTARE una giornata e non sa
-- CONTARLA. "Stasera pizza con Christian, prima un'ora di palestra" diventa
-- un titolo e due frasi di sintesi, e fra un mese non c'e modo di rispondere
-- a "quante volte ho mangiato la pizza", "quante volte sono andato in
-- palestra", "quand'e l'ultima volta che ho visto Christian". Non perche
-- l'AI sia debole: perche non esisteva un posto dove mettere quei fatti.
--
-- UNA TABELLA SOLA, non una per argomento. "Pizza", "panca piana" e
-- "Christian" hanno la stessa forma - un giorno, un tipo, un'etichetta - e
-- differiscono solo per `kind`. Il criterio che ha guidato il disegno:
-- aggiungere "yoga" o "sushi" l'anno prossimo non deve richiedere ne una
-- migration, ne una schermata nuova, ne un rilascio.
--
-- LE DUE COLONNE DELL'ETICHETTA sono la parte che decide se i conteggi
-- funzionano:
--   - `label` e come l'hai detto tu: "una margherita da Gino". Si MOSTRA.
--   - `label_key` e la forma con cui si CONTA: "pizza". Se "panca" e "panca
--     piana" finiscono in due chiavi diverse, il grafico dei progressi si
--     spezza in due meta che non si sommano mai.
-- La prova del 22 agosto 2026 (RISULTATI-prova-modelli.md) ha mostrato che
-- nessun modello ci arriva da solo: serve `fact_aliases` qui sotto, piu
-- l'elenco delle etichette gia usate passato al modello.

set search_path = public;

create table if not exists public.facts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- entry_id per sparire insieme alla giornata; entry_date duplicata perche
  -- TUTTE le domande utili sono per data ("le pizze di maggio") e farle
  -- passare da un join sarebbe uno spreco a ogni conteggio.
  entry_id uuid references public.entries(id) on delete cascade,
  entry_date date not null,
  kind text not null
    check (kind in ('cibo', 'attivita', 'persona', 'lavoro', 'luogo')),
  label text not null,
  label_key text not null,
  attrs jsonb not null default '{}'::jsonb,
  -- 0..1: quanto l'AI e sicura. Sotto soglia il fatto si mostra ma chiede
  -- conferma, invece di entrare zitto nei conteggi.
  confidence real,
  -- 'manual' e cio che hai scritto tu. Una rilettura del testo cancella e
  -- rifa i fatti 'ai' di quel giorno, e non tocca MAI i 'manual': un'AI non
  -- cancella cio che ha scritto una persona.
  origin text not null default 'ai' check (origin in ('ai', 'manual')),
  created_at timestamptz not null default now()
);

create index if not exists facts_user_date_idx
  on public.facts (user_id, entry_date desc);
create index if not exists facts_user_kind_key_idx
  on public.facts (user_id, kind, label_key);
create index if not exists facts_entry_idx on public.facts (entry_id);

alter table public.facts enable row level security;

-- Come le altre quattro tabelle: ognuno vede e scrive solo le proprie righe.
-- NESSUNA policy per il service role: il server non legge i diari, e questa
-- tabella - che e la piu dettagliata di tutte - non fa eccezione.
create policy "facts: read own" on public.facts
  for select using (auth.uid() = user_id);
create policy "facts: insert own" on public.facts
  for insert with check (auth.uid() = user_id);
create policy "facts: update own" on public.facts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "facts: delete own" on public.facts
  for delete using (auth.uid() = user_id);


-- =====================
-- Gli alias: la memoria delle correzioni.
--
-- Quando dici "no, 'panca' e 'panca piana'", quella correzione deve valere
-- PER SEMPRE, o la stessa fatica si rifa ogni settimana e i conteggi restano
-- spazzatura. Una riga qui dice: per questo utente, in questo tipo, questa
-- forma vale come quest'altra.
--
-- La chiave primaria (utente, tipo, alias) impedisce che lo stesso alias
-- punti a due canonici diversi: sarebbe un conteggio che cambia a seconda
-- dell'ordine di lettura.
create table if not exists public.fact_aliases (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null
    check (kind in ('cibo', 'attivita', 'persona', 'lavoro', 'luogo')),
  alias text not null,
  label_key text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, kind, alias)
);

alter table public.fact_aliases enable row level security;

create policy "fact_aliases: read own" on public.fact_aliases
  for select using (auth.uid() = user_id);
create policy "fact_aliases: insert own" on public.fact_aliases
  for insert with check (auth.uid() = user_id);
create policy "fact_aliases: update own" on public.fact_aliases
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "fact_aliases: delete own" on public.fact_aliases
  for delete using (auth.uid() = user_id);
