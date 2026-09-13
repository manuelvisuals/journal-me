-- 030_recensione.sql (13 settembre 2026)
--
-- LA RICHIESTA DI RECENSIONE, DORMIENTE (richiesta di Manuel: "disattivato
-- per ora, ma che posso attivare da admin e tutti gli utenti lo ricevono,
-- senza dover aggiornare l'app").
--
-- Il pezzo che chiede la recensione (il foglio di Apple, SKStoreReviewController)
-- e gia dentro il binario dalla build 4; QUESTA riga e l'interruttore che lo
-- sveglia. L'app la legge dal server (GET /api/recensione) una volta al
-- giorno; il pannello /admin la scrive. Cambiarla vale per tutte le app
-- installate, senza deploy e senza aggiornamento.
--
-- Come `regalo`: una riga sola, letta e scritta solo col service role.
-- Nessuna policy: il browser non la tocca mai direttamente.

set search_path = public;

create table if not exists recensione (
  id smallint primary key default 1 check (id = 1),
  attiva boolean not null default false,
  -- Quante giornate deve aver salvato QUEL telefono prima che si chieda.
  giornate_minime integer not null default 5 check (giornate_minime >= 0),
  updated_at timestamptz not null default now()
);

insert into recensione (id) values (1) on conflict (id) do nothing;

alter table recensione enable row level security;
-- Nessuna policy: legge e scrive solo il server col service role.

-- Il contatore: una riga per ogni volta che un'app ha CHIESTO il foglio ad
-- Apple. Senza chi: non serve, e Apple comunque non dice se il foglio e
-- comparso ne se la persona ha scritto.
create table if not exists recensione_richieste (
  id uuid primary key default gen_random_uuid(),
  piattaforma text not null default 'ios',
  creato_il timestamptz not null default now()
);

create index if not exists recensione_richieste_quando on recensione_richieste (creato_il desc);

alter table recensione_richieste enable row level security;
-- Nessuna policy: scrive solo il server col service role.
