-- 019_sito.sql
-- Il sito pubblico su dayalogue.com (mockup design/mockups/sito-seo.html,
-- approvato da Manuel il 31 agosto 2026).
--
-- Due tabelle, e nessuna delle due contiene dati di un utente del diario.
--
--   sito_seo   i testi che Google legge: titolo e descrizione di ogni pagina
--              pubblica, in italiano e in inglese. Si cambiano dal pannello
--              /admin senza toccare il codice e senza un nuovo deploy.
--   supporto   le richieste che arrivano da dayalogue.com/support.
--
-- PERCHE IL SEO STA A DATABASE E NON NEL CODICE. Perche il titolo e la
-- descrizione sono la cosa che si riscrive dieci volte per vedere se il
-- risultato su Google migliora, e ogni riscrittura, se stesse nel codice,
-- sarebbe un commit, un deploy e un'attesa. Il resto della pagina (l'eroe,
-- le domande, il piede) resta invece nel codice in due lingue: sono
-- prodotto, non impostazioni, e cambiarli e un lavoro da mockup.
--
-- SE QUESTA TABELLA E' VUOTA O IRRAGGIUNGIBILE IL SITO ESCE LO STESSO, coi
-- testi di fabbrica scritti in src/modules/sito/seo.ts. Un sito che va giu
-- perche una tabella di configurazione non risponde sarebbe un difetto piu
-- grave di quello che stiamo risolvendo (stessa dottrina di leggiAree).

set search_path = public;

-- ------------------------------------------------------------------ SEO

create table if not exists public.sito_seo (
  -- 'home' | 'support'. Opaca come la chiave delle aree: e cio che il
  -- codice cerca, e non si rinomina.
  pagina text primary key,

  titolo_it text not null default '',
  descrizione_it text not null default '',
  titolo_en text not null default '',
  descrizione_en text not null default '',

  -- Quando la pagina viene condivisa (WhatsApp, Telegram, X, LinkedIn).
  -- Vuoti = si usa il titolo e la descrizione qui sopra: un campo vuoto che
  -- si arrangia e meglio di due campi da tenere allineati a mano.
  og_titolo_it text not null default '',
  og_titolo_en text not null default '',
  og_immagine text,

  -- Spento = la pagina resta online ma chiede ai motori di non indicizzarla.
  -- Serve per tenere fuori dai risultati una pagina finche non e pronta,
  -- senza doverla cancellare.
  indicizzabile boolean not null default true,

  updated_at timestamptz not null default now()
);

alter table public.sito_seo enable row level security;

-- Lettura pubblica: la home deve saper scrivere il proprio titolo prima di
-- sapere chi sei — anzi, soprattutto quando chi legge e un motore di
-- ricerca, che non ha e non avra mai un account.
create policy "sito_seo: lettura pubblica" on public.sito_seo
  for select using (true);

-- Nessuna policy di scrittura: si scrive SOLO dal service role, cioe dalla
-- rotta admin. Stessa regola di `aree` (015).

insert into public.sito_seo (pagina, titolo_it, descrizione_it, titolo_en, descrizione_en, og_titolo_it, og_titolo_en) values
  ('home',
   'dayalogue - il diario che si racconta a voce',
   'Parli due minuti a fine giornata: dayalogue trascrive, scrive il titolo e la sintesi, e tiene in ordine persone e ricordi.',
   'dayalogue - the journal you tell out loud',
   'Talk for two minutes at the end of the day: dayalogue transcribes it, writes the headline and the summary, and keeps your people and notes in order.',
   'Racconta la giornata. Il resto lo scrive lui.',
   'Tell your day. It writes the rest.'),
  ('support',
   'Assistenza - dayalogue',
   'Qualcosa non funziona o hai una domanda? Scrivici da qui: rispondiamo a tutti.',
   'Support - dayalogue',
   'Something not working, or a question? Write to us here: we answer everyone.',
   '', '')
on conflict (pagina) do nothing;

-- ------------------------------------------------------- ASSISTENZA

create table if not exists public.supporto (
  id uuid primary key default gen_random_uuid(),
  creata_il timestamptz not null default now(),

  oggetto text not null,
  descrizione text not null,
  -- Serve solo per rispondere. Non e un account e non diventa un account.
  email text not null,
  -- 'it' | 'en': si risponde nella lingua in cui e stato scritto.
  lingua text not null default 'it',

  -- Le schermate come data URL, ridotte dal browser prima di partire
  -- (stessa scelta della foto profilo, migration 016: per questa taglia un
  -- bucket con le sue policy e i suoi URL firmati e piu infrastruttura di
  -- quanta ne risparmi). Il tetto e nello schema e non solo nel client,
  -- perche un limite che si vede nello schema e piu onesto.
  immagini text[] not null default '{}',

  -- Cio che si sa di chi scrive SENZA chiederglielo: browser e schermo
  -- risolvono meta delle segnalazioni ("non si vede il tasto" quasi sempre
  -- vuol dire una larghezza che non avevamo previsto).
  contesto jsonb not null default '{}'::jsonb,

  -- Il ciclo di vita, per il pannello: nuova -> letta -> chiusa.
  stato text not null default 'nuova'
);

create index if not exists supporto_creata_idx on public.supporto (creata_il desc);

alter table public.supporto enable row level security;

-- Nessuna policy, ne in lettura ne in scrittura: chi scrive passa dalla
-- rotta /api/sito/supporto (service role, che valida e limita), chi legge
-- passa dal pannello admin. Una policy di insert pubblica qui sarebbe un
-- modulo aperto sul mondo con dentro il nostro database.

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'supporto_immagini_max'
  ) then
    alter table public.supporto
      add constraint supporto_immagini_max
      check (array_length(immagini, 1) is null or array_length(immagini, 1) <= 3);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'supporto_testo_max'
  ) then
    alter table public.supporto
      add constraint supporto_testo_max
      check (length(oggetto) <= 200 and length(descrizione) <= 5000 and length(email) <= 320);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'supporto_stato_valido'
  ) then
    alter table public.supporto
      add constraint supporto_stato_valido
      check (stato in ('nuova', 'letta', 'chiusa'));
  end if;
end $$;
