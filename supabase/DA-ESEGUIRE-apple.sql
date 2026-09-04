-- DA INCOLLARE NEL SUPABASE SQL EDITOR (progetto fljshsmpmpzapcczsbwc), UNA VOLTA,
-- PRIMA del merge del branch abbonamento-iap, DOPO DA-ESEGUIRE-ospite.sql (serve la tabella regalo).
-- E la migration 024 tale e quale. Si puo rieseguire senza danni: provata due volte su Postgres 16 locale.
-- NON eseguita in produzione da Claude: la esegue Manuel.

-- 024_apple.sql
-- L'acquisto dentro l'app iOS (In-App Purchase, StoreKit 2), deciso da
-- Manuel il 4 settembre 2026 (mockup design/mockups/abbonamento-iphone.html,
-- v3). Branch abbonamento-iap.
--
--   profiles           riceve le colonne di Apple: la transazione originale
--                      (l'identita dell'abbonamento presso Apple, unica),
--                      il prodotto comprato, l'ambiente (Sandbox/Production).
--                      plan_source vale 'apple'. La scadenza sta nella
--                      colonna che c'era gia, current_period_end: da questa
--                      migration il server la RISPETTA (un premium scaduto e
--                      un free, vedi src/lib/server/piano.ts).
--   apple_notifiche    ogni avviso del server di Apple (App Store Server
--                      Notifications V2), con il suo UUID unico: lo stesso
--                      avviso consegnato due volte non viene applicato due
--                      volte. Solo il service role legge e scrive.
--   regalo             riceve l'interruttore dell'ANNUALE (decisione di
--                      Manuel, opzione 1): il prodotto annuale puo esistere
--                      su App Store Connect e restare nascosto nell'app
--                      finche questo non e vero. Lettura pubblica come il
--                      resto della riga: sono limiti, non dati.
--   ios-v1             i profili con plan_source = 'ios-v1' (il premium
--                      gratis della prima versione iOS, che con l'acquisto
--                      vero sparisce) ricevono UN MESE di premium da oggi,
--                      poi scadono da soli (decisione C di Manuel: un mese,
--                      se e semplice; lo e: una riga).
--
-- Idempotente: si puo rieseguire senza danni.

set search_path = public;

alter table profiles add column if not exists apple_original_transaction_id text;
alter table profiles add column if not exists apple_product_id text;
alter table profiles add column if not exists apple_environment text;
-- L'ultima notifica applicata, per capire da dove viene lo stato corrente.
alter table profiles add column if not exists apple_ultimo_avviso text;

-- Unico: una transazione originale appartiene a un solo account. Un indice
-- unique su colonna nullable ammette piu NULL (come per Stripe, 008).
create unique index if not exists profiles_apple_original_transaction_id_key
  on profiles (apple_original_transaction_id);

create table if not exists apple_notifiche (
  notification_uuid text primary key,
  tipo text not null,
  sottotipo text,
  original_transaction_id text,
  user_id uuid references auth.users(id) on delete set null,
  ambiente text,
  ricevuta_il timestamptz not null default now(),
  applicata boolean not null default false,
  esito text
);

create index if not exists apple_notifiche_transazione on apple_notifiche (original_transaction_id, ricevuta_il desc);

alter table apple_notifiche enable row level security;
-- Nessuna policy: solo il service role.

alter table regalo add column if not exists annuale_attivo boolean not null default false;

-- Il premium gratis della v1 iOS: un mese da oggi, poi scade da solo.
-- Solo chi non ha GIA una scadenza (cosi rieseguire non allunga niente).
update profiles
   set current_period_end = now() + interval '1 month'
 where plan = 'premium'
   and plan_source = 'ios-v1'
   and current_period_end is null;
