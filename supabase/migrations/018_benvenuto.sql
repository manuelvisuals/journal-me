-- Il messaggio di benvenuto diventa dati (31 agosto 2026).
-- Mockup approvato da Manuel: design/mockups/messaggio-benvenuto.html
-- (strada 1, disegno "Prima").
--
-- PERCHE UNA TABELLA E NON UN FILE NEL CODICE. Il testo di benvenuto e'
-- l'unica cosa dell'app che Manuel vuole poter cambiare senza aspettare un
-- deploy: e' una lettera, e una lettera si riscrive. Finche' vive in un
-- file, ogni virgola costa un push, una build Vercel e (sul telefono) una
-- build nuova dell'app.
--
-- UNA RIGA SOLA, PER SEMPRE. `id smallint primary key default 1 check
-- (id = 1)` e' il modo piu' corto di dire "questa tabella ha una riga".
-- Senza il check, un upsert sbagliato ne creerebbe una seconda e l'app
-- leggerebbe quella che capita.
--
-- PERCHE LE IMMAGINI STANNO DENTRO LA RIGA. Stessa ragione della foto
-- profilo (migration 016): una foto tonda da 320px in JPEG e' ~16 KB, cioe'
-- ~22 KB in base64. Per quella taglia un deposito file vorrebbe dire un
-- bucket, le sue policy, gli URL firmati e un pezzo di infrastruttura in
-- piu' da ricordare per sempre. Il tetto e' scritto nello schema e non solo
-- nel client: un limite che si vede e' piu' onesto di un limite promesso.
--
-- `versione` E' IL TASTO "MOSTRALO DI NUOVO". Chi spunta "non mostrare
-- piu'" resta in silenzio, e in modalita' locale quel silenzio non scade
-- mai (non c'e' nessun logout). Senza questo numero, il giorno che Manuel
-- riscrive il messaggio non lo leggerebbe proprio chi apre l'app tutte le
-- sere. Il client si ricorda l'ultima versione vista: quando il numero
-- cambia, il silenzio cade da solo e il messaggio torna una volta.
--
-- NESSUNA POLICY DI SCRITTURA, come per `aree` (015): si scrive solo dal
-- service role, cioe' dalla rotta admin.

set search_path = public;

create table if not exists public.benvenuto (
  id smallint primary key default 1 check (id = 1),

  -- Spento: non lo vede piu' nessuno, senza dover svuotare il testo.
  attivo boolean not null default true,
  -- Alzalo di uno e il messaggio torna per tutti, una volta.
  versione integer not null default 1,

  -- Italiano. E' la lingua di riserva: se l'inglese e' vuoto, si mostra
  -- questo. Meglio una frase nella lingua sbagliata che un riquadro vuoto.
  occhiello text not null default '',
  promessa text not null default '',
  evidenza text not null default '',
  -- Righe vuote fra un paragrafo e l'altro; *fra asterischi* = grassetto.
  testo text not null default '',
  firma text not null default '',
  bottone text not null default '',
  -- La riga cliccabile in fondo. Vuote tutte e due = la riga non compare:
  -- un invito che non porta da nessuna parte e' una promessa rotta al
  -- primo tocco (stessa regola del "primo mese incluso" tolto il 20
  -- agosto). Serve anche alla linguetta Feedback, che apre questo stesso
  -- indirizzo e resta muta finche' e' vuoto.
  contatto_riga text not null default '',
  contatto_url text not null default '',

  -- Inglese. Vuoto = si mostra l'italiano.
  occhiello_en text not null default '',
  promessa_en text not null default '',
  evidenza_en text not null default '',
  testo_en text not null default '',
  firma_en text not null default '',
  bottone_en text not null default '',
  contatto_riga_en text not null default '',

  -- Immagini come data URL. null = quella cotta dentro il pacchetto.
  foto_data text,
  -- Due loghi, non uno: il segno di dayalogue e' un disegno scuro e sui
  -- temi scuri sparisce. Decisione di Manuel, 31 agosto 2026.
  logo_tema_chiaro_data text,
  logo_tema_scuro_data text,

  updated_at timestamptz not null default now()
);

-- Il tetto: ~64 KB di base64 per immagine, cioe' circa 48 KB di file.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'benvenuto_foto_size') then
    alter table public.benvenuto add constraint benvenuto_foto_size
      check (foto_data is null or length(foto_data) <= 65536);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'benvenuto_logo_chiaro_size') then
    alter table public.benvenuto add constraint benvenuto_logo_chiaro_size
      check (logo_tema_chiaro_data is null or length(logo_tema_chiaro_data) <= 65536);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'benvenuto_logo_scuro_size') then
    alter table public.benvenuto add constraint benvenuto_logo_scuro_size
      check (logo_tema_scuro_data is null or length(logo_tema_scuro_data) <= 65536);
  end if;
end $$;

alter table public.benvenuto enable row level security;

-- Lettura pubblica come per le aree: il messaggio non contiene niente di
-- personale, ed e' la prima cosa che l'app deve saper disegnare.
drop policy if exists "benvenuto: lettura pubblica" on public.benvenuto;
create policy "benvenuto: lettura pubblica" on public.benvenuto
  for select using (true);

-- La riga di partenza: le stesse parole del mockup approvato. Da qui in
-- avanti si cambiano dal pannello, mai piu' da una migration.
insert into public.benvenuto (
  id, occhiello, promessa, evidenza, testo, firma, bottone,
  occhiello_en, promessa_en, evidenza_en, testo_en, firma_en, bottone_en
) values (
  1,
  'Benvenuto in',
  'Racconti la giornata a voce, come viene. dayalogue la scrive, le da un titolo e la divide in aree, e te la rida nel Mese e nei Recap.',
  'Nessuna pubblicita. Le tue giornate non si vendono.',
  'Ho fatto dayalogue come il diario che volevo per me: cinque minuti a fine giornata, e mesi dopo ritrovarci qualcosa.

E'' ancora il progetto di una persona sola, agli inizi: quello che mi scrivi cambia davvero cosa arriva dopo.

Se qualcosa e confuso, rotto o manca, *scrivimi prima di lasciar perdere*. Leggo tutti i messaggi e rispondo io.',
  'Manuel',
  'Inizia',
  'Welcome to',
  'Tell your day out loud, just as it comes. dayalogue writes it down, gives it a headline, splits it into areas, and hands it back in Month and Recaps.',
  'No ads. Your days are never sold.',
  'I built dayalogue as the diary I wanted for myself: five minutes at the end of the day, and something worth finding again months later.

It is still an early-stage, one-person project, so what you write me genuinely shapes what comes next.

If something feels confusing, broken or missing, *please message me before giving up*. I read every message and reply personally.',
  'Manuel',
  'Get started'
)
on conflict (id) do nothing;
