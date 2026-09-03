-- 023_ospite.sql
-- L'ospite e la quota (SPEC-ospite-e-cassaforte.md, R2 R3 R4; referto
-- src/modules/accesso/REFERTO-ospite-mappa.md par. 10; notte del 3 settembre
-- 2026, branch ospite-server).
--
-- Chi apre l'app senza account riceve un regalo di AI, contato SUL SERVER
-- (R2: un conteggio che vive solo sul dispositivo e un suggerimento). Il
-- server non sa chi e la persona: conosce solo un BRACCIALETTO, cioe un
-- segreto casuale che il dispositivo genera alla prima apertura e tiene nel
-- portachiavi iCloud (sopravvive alla disinstallazione, R2) o in IndexedDB.
-- Qui arriva solo il suo hash.
--
--   regalo                 UNA riga (check id = 1, come `benvenuto`): il
--                          regalo e acceso?, quante giornate per ospite, il
--                          tetto mensile in euro, il cambio USD->EUR con cui
--                          si legge la spesa. Si cambia da /admin senza deploy
--                          (R4). Lettura pubblica: contiene solo i limiti,
--                          MAI la spesa.
--   braccialetti           un braccialetto = una riga: hash del segreto, e
--                          l'utente a cui e stato legato quando l'ospite ha
--                          messo la email (cosi la quota non ricomincia).
--   braccialetto_giornate  una riga per GIORNO su cui l'AI ha lavorato per
--                          quel braccialetto. Il numero di righe E la quota
--                          consumata: rilavorare la stessa giornata non costa
--                          (decisione C del mockup, proposta).
--   ai_usage               riceve braccialetto_id, il flag `regalo` (la
--                          chiamata l'ha pagata il regalo) e costo_usd, cosi
--                          la spesa del mese e una somma sola; user_id
--                          diventa nullable (un ospite non sta in auth.users).
--
-- Le scritture passano SOLO dal service role: nessuna tabella nuova ha
-- policy di insert/update/delete, e il conteggio della quota e una funzione
-- SQL che decide sotto lock di riga (due chiamate parallele dello stesso
-- braccialetto non ottengono due giornate col prezzo di una).
--
-- Idempotente: si puo rieseguire senza danni.

set search_path = public;

-- ------------------------------------------------------------------ regalo
create table if not exists regalo (
  id smallint primary key default 1 check (id = 1),
  attivo boolean not null default true,
  giornate_per_ospite integer not null default 10 check (giornate_per_ospite >= 0),
  tetto_mensile_eur numeric not null default 100 check (tetto_mensile_eur >= 0),
  -- La spesa si stima in USD (listini di ai-usage.ts) e il tetto si legge in
  -- euro: il cambio e fisso e si cambia qui. Valore di fabbrica 0,92.
  cambio_usd_eur numeric not null default 0.92 check (cambio_usd_eur > 0),
  updated_at timestamptz not null default now()
);

insert into regalo (id) values (1) on conflict (id) do nothing;

alter table regalo enable row level security;
drop policy if exists "regalo: lettura pubblica" on regalo;
create policy "regalo: lettura pubblica" on regalo for select using (true);
-- Nessuna policy di scrittura: scrive solo il pannello admin col service role.

-- ------------------------------------------------------------ braccialetti
create table if not exists braccialetti (
  id uuid primary key default gen_random_uuid(),
  -- SHA-256 (hex) del segreto: il segreto in chiaro non arriva mai qui.
  segreto_hash text not null unique,
  -- L'account a cui l'ospite e diventato, se e successo. Il braccialetto
  -- resta: e la memoria della quota gia usata.
  user_id uuid references auth.users(id) on delete set null,
  creato_il timestamptz not null default now(),
  ultimo_uso timestamptz not null default now()
);

create index if not exists braccialetti_user on braccialetti (user_id) where user_id is not null;

alter table braccialetti enable row level security;
-- Nessuna policy: solo il service role legge e scrive.

create table if not exists braccialetto_giornate (
  braccialetto_id uuid not null references braccialetti(id) on delete cascade,
  giorno date not null,
  creato_il timestamptz not null default now(),
  primary key (braccialetto_id, giorno)
);

alter table braccialetto_giornate enable row level security;
-- Nessuna policy: solo il service role.

-- ---------------------------------------------------------------- ai_usage
alter table ai_usage alter column user_id drop not null;
alter table ai_usage add column if not exists braccialetto_id uuid references braccialetti(id) on delete set null;
alter table ai_usage add column if not exists regalo boolean not null default false;
alter table ai_usage add column if not exists costo_usd numeric not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'ai_usage_chi_ha_chiamato'
  ) then
    alter table ai_usage add constraint ai_usage_chi_ha_chiamato
      check (user_id is not null or braccialetto_id is not null);
  end if;
end $$;

-- La somma del mese (R4) non deve fare seq scan: un indice sul tempo, e uno
-- sulle sole righe del regalo, che sono quelle che il tetto somma.
create index if not exists ai_usage_created on ai_usage (created_at desc);
create index if not exists ai_usage_regalo_created on ai_usage (created_at desc) where regalo;
create index if not exists ai_usage_braccialetto on ai_usage (braccialetto_id, created_at desc) where braccialetto_id is not null;

-- --------------------------------------------------------------- funzioni
-- Chiede al database di spendere una giornata del regalo per un braccialetto.
--   p_max          giornate_per_ospite del momento (letto da `regalo`)
--   p_blocca_nuove true quando il regalo e spento o il tetto e superato:
--                  le giornate GIA iniziate si finiscono (R4), le nuove no.
-- Risponde con un json: { esito, usate, gia }
--   esito 'ok'        la giornata e concessa (nuova, o gia contata: gia=true)
--         'quota'     il braccialetto ha finito le sue giornate
--         'bloccato'  regalo spento o tetto superato, e la giornata e nuova
-- Decide sotto lock della riga del braccialetto: due chiamate parallele si
-- mettono in fila e vedono lo stesso conteggio.
create or replace function usa_giornata_ospite(
  p_braccialetto_id uuid,
  p_giorno date,
  p_max integer,
  p_blocca_nuove boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
  gia boolean;
begin
  perform 1 from braccialetti where id = p_braccialetto_id for update;
  if not found then
    return jsonb_build_object('esito', 'bloccato', 'usate', 0, 'gia', false);
  end if;

  select count(*) into n from braccialetto_giornate where braccialetto_id = p_braccialetto_id;
  select exists (
    select 1 from braccialetto_giornate
    where braccialetto_id = p_braccialetto_id and giorno = p_giorno
  ) into gia;

  if gia then
    update braccialetti set ultimo_uso = now() where id = p_braccialetto_id;
    return jsonb_build_object('esito', 'ok', 'usate', n, 'gia', true);
  end if;
  if p_blocca_nuove then
    return jsonb_build_object('esito', 'bloccato', 'usate', n, 'gia', false);
  end if;
  if n >= p_max then
    return jsonb_build_object('esito', 'quota', 'usate', n, 'gia', false);
  end if;

  insert into braccialetto_giornate (braccialetto_id, giorno) values (p_braccialetto_id, p_giorno);
  update braccialetti set ultimo_uso = now() where id = p_braccialetto_id;
  return jsonb_build_object('esito', 'ok', 'usate', n + 1, 'gia', false);
end;
$$;

revoke all on function usa_giornata_ospite(uuid, date, integer, boolean) from public;
do $$
begin
  -- I ruoli di Supabase non esistono su un Postgres qualunque (il banco locale).
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function usa_giornata_ospite(uuid, date, integer, boolean) from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on function usa_giornata_ospite(uuid, date, integer, boolean) from authenticated;
  end if;
end $$;

-- Quanto ha speso il regalo dal primo del mese (UTC), in USD stimati.
-- Una somma sola, sull'indice parziale qui sopra.
create or replace function speso_regalo_mese()
returns numeric
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(sum(costo_usd), 0)
  from ai_usage
  where regalo
    and created_at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc';
$$;

revoke all on function speso_regalo_mese() from public;
do $$
begin
  -- I ruoli di Supabase non esistono su un Postgres qualunque (il banco locale).
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function speso_regalo_mese() from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on function speso_regalo_mese() from authenticated;
  end if;
end $$;

-- Il pannello admin vuole anche il conto degli ospiti e delle giornate del
-- mese: una funzione sola, cosi la schermata non tiene tre query.
create or replace function riassunto_regalo_mese()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'speso_usd', coalesce((select sum(costo_usd) from ai_usage
      where regalo and created_at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc'), 0),
    'ospiti', (select count(distinct braccialetto_id) from ai_usage
      where regalo and created_at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc'),
    'giornate', (select count(*) from braccialetto_giornate
      where creato_il >= date_trunc('month', now() at time zone 'utc') at time zone 'utc')
  );
$$;

revoke all on function riassunto_regalo_mese() from public;
do $$
begin
  -- I ruoli di Supabase non esistono su un Postgres qualunque (il banco locale).
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function riassunto_regalo_mese() from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on function riassunto_regalo_mese() from authenticated;
  end if;
end $$;
