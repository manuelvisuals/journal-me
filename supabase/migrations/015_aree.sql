-- Le macro-aree diventano dati (25 agosto 2026).
--
-- Erano un elenco chiuso scritto nel codice in sette punti: lo schema del
-- riassunto, le domande di chiarimento, l'ordine di lettura della giornata,
-- le icone, due cataloghi di traduzione e due guardie. Aggiungerne una li
-- toccava tutti, quindi non si aggiungeva mai. Da qui si aggiunge dal
-- pannello admin.
--
-- LA COSA PIU IMPORTANTE DI QUESTA TABELLA E' LA DIFFERENZA FRA `chiave` E
-- `nome`. Dentro ogni giornata gia salvata (entries.areas) c'e scritta la
-- parola "Lavoro": finora il nome visibile era anche l'identita, quindi
-- rinominare un'area avrebbe scollegato tutto lo storico. Qui la chiave e
-- opaca e non si cambia mai; il nome e solo cio che si legge a schermo, e su
-- quello si puo cambiare idea quando si vuole.
--
-- Per questo le sei chiavi di partenza sono ESATTAMENTE le etichette che il
-- database ha gia dentro le giornate, maiuscola compresa: cosi non serve
-- riscrivere nemmeno una riga di storico. Le aree nuove prendono per chiave
-- il nome del giorno in cui nascono, e da li in poi quella chiave e ferma.
--
-- `cosa_ci_va` non e una nota per l'umano: finisce parola per parola dentro
-- le istruzioni del modello. Le frasi che dicono cosa NON va in un'area sono
-- quelle che funzionano meglio, ed e per questo che qui ci sono.

set search_path = public;

create table if not exists public.aree (
  -- Opaca e immutabile: e cio che viene scritto dentro le giornate.
  chiave text primary key,
  nome text not null,
  nome_en text not null,
  cosa_ci_va text not null default '',
  -- L'ordine di lettura nella giornata: prima cio che sta fuori, poi il
  -- corpo, poi cio che sta dentro. Stava in un elenco a parte nel codice
  -- della schermata: due liste che devono restare d'accordo prima o poi
  -- litigano.
  ordine integer not null,
  -- Il nome del disegno, oppure niente. Corpo non ha mai avuto un'icona.
  icona text,
  -- Spenta, non cancellata: cancellare lascerebbe le giornate vecchie con
  -- un'etichetta che non esiste piu. Spenta smette di essere assegnata da
  -- oggi e lo storico resta leggibile.
  attiva boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists aree_ordine_idx on public.aree (ordine);

alter table public.aree enable row level security;

-- Le aree sono le stesse per tutti e non contengono niente di personale: le
-- legge chiunque, anche chi non ha ancora un account (la schermata di una
-- giornata deve saper scrivere "Lavoro" prima di sapere chi sei).
create policy "aree: lettura pubblica" on public.aree
  for select using (true);

-- Nessuna policy di scrittura: si scrive SOLO dal service role, cioe dalla
-- rotta admin. Un utente qualunque non puo aggiungere un'area nemmeno
-- provandoci dal client.

insert into public.aree (chiave, nome, nome_en, cosa_ci_va, ordine, icona) values
  ('Lavoro',    'Lavoro',    'Work',
   'Progetti, ufficio, studio fatto per lavoro, soldi guadagnati, colleghi in quanto colleghi.',
   10, 'lavoro'),
  ('Relazioni', 'Relazioni', 'Relationships',
   'Persone incontrate o nominate, famiglia, amici, appuntamenti. Una persona nominata sta sempre qui.',
   20, 'relazioni'),
  ('Cibo',      'Cibo',      'Food',
   'Cosa ha mangiato e bevuto. Un pasto sta sempre qui, mai in Corpo.',
   30, 'cibo'),
  ('Movimento', 'Movimento', 'Movement',
   'Palestra, camminate, sport, piscina fatta per allenarsi. Il corpo che si muove apposta.',
   40, 'movimento'),
  ('Corpo',     'Corpo',     'Body',
   'Il resto del corpo che non e ne cibo ne movimento: sonno, stanchezza, dolori, malattie, peso.',
   50, null),
  ('Emozioni',  'Emozioni',  'Emotions',
   'Come si e sentito, se lo dice. Qui non si interpreta: niente letture psicologiche non richieste.',
   60, 'emozioni')
on conflict (chiave) do nothing;
