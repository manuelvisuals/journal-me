-- GIA ESEGUITA IN PRODUZIONE da Claude il 4 settembre 2026 (Management API), verificata: 7 colonne, la funzione, l'indice.
-- Tenuta qui per memoria: si puo rieseguire senza danni.
-- E la migration 025 tale e quale. Si puo rieseguire senza danni: provata due volte su Postgres 16 locale.

-- 025_premium_braccialetto.sql
-- Premium senza password (mockup design/mockups/premium-senza-password.html,
-- risposte di Manuel del 4 settembre 2026: A2 B1 C1 D1 E1). Branch
-- premium-senza-password.
--
--   braccialetti       riceve le stesse colonne di Apple che ha profiles:
--                      l'abbonamento comprato dall'ospite vive sul
--                      BRACCIALETTO del telefono finche la persona non mette
--                      una email. Cosi si compra con un tocco (foglio di
--                      Apple) e senza account, come vuole la linea guida
--                      5.1.1 di Apple. La transazione originale e unica anche
--                      qui: un abbonamento sta su UN braccialetto.
--   adotta_braccialetto  quando l'ospite mette l'email (login), il
--                      braccialetto viene legato all'account e, se porta un
--                      premium ancora valido, il premium PASSA all'account
--                      (profiles) e si spegne sul braccialetto: da li in poi
--                      vale sul web e su ogni dispositivo dell'account. Se
--                      l'account ha gia un premium migliore, non si tocca.
--
-- Idempotente: si puo rieseguire senza danni.

set search_path = public;

alter table braccialetti add column if not exists plan text not null default 'free';
alter table braccialetti add column if not exists plan_source text;
alter table braccialetti add column if not exists current_period_end timestamptz;
alter table braccialetti add column if not exists apple_original_transaction_id text;
alter table braccialetti add column if not exists apple_product_id text;
alter table braccialetti add column if not exists apple_environment text;
alter table braccialetti add column if not exists apple_ultimo_avviso text;

create unique index if not exists braccialetti_apple_original_transaction_id_key
  on braccialetti (apple_original_transaction_id);

-- L'ospite diventa account: il braccialetto si lega, e il premium (se
-- valido) passa al profilo. Torna quanto e successo.
create or replace function adotta_braccialetto(p_braccialetto_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  b braccialetti%rowtype;
  fine_profilo timestamptz;
  piano_profilo text;
  gia_usata uuid;
begin
  select * into b from braccialetti where id = p_braccialetto_id for update;
  if not found then
    return jsonb_build_object('esito', 'assente');
  end if;

  update braccialetti set user_id = p_user_id, ultimo_uso = now() where id = p_braccialetto_id;

  -- Niente premium valido sul braccialetto: solo il legame.
  if b.plan is distinct from 'premium' or b.current_period_end is null or b.current_period_end <= now() then
    return jsonb_build_object('esito', 'legato', 'premium_spostato', false);
  end if;

  -- La stessa transazione e gia su un altro profilo? Allora resta li.
  select user_id into gia_usata from profiles
    where apple_original_transaction_id = b.apple_original_transaction_id
      and user_id <> p_user_id;
  if gia_usata is not null then
    return jsonb_build_object('esito', 'legato', 'premium_spostato', false, 'motivo', 'transazione_di_altro_account');
  end if;

  select plan, current_period_end into piano_profilo, fine_profilo from profiles where user_id = p_user_id;

  -- Il profilo ha gia un premium che dura di piu: non si tocca.
  if piano_profilo = 'premium' and fine_profilo is not null and fine_profilo >= b.current_period_end then
    return jsonb_build_object('esito', 'legato', 'premium_spostato', false, 'motivo', 'profilo_gia_premium');
  end if;

  -- Prima si libera la transazione sul braccialetto (indice unico), poi si
  -- scrive sul profilo.
  update braccialetti
    set plan = 'free', plan_source = null, current_period_end = null,
        apple_original_transaction_id = null, apple_product_id = null,
        apple_environment = null, apple_ultimo_avviso = null
    where id = p_braccialetto_id;

  insert into profiles (user_id, plan, plan_source, current_period_end,
                        apple_original_transaction_id, apple_product_id, apple_environment)
    values (p_user_id, 'premium', coalesce(b.plan_source, 'apple'), b.current_period_end,
            b.apple_original_transaction_id, b.apple_product_id, b.apple_environment)
    on conflict (user_id) do update set
      plan = 'premium',
      plan_source = coalesce(b.plan_source, 'apple'),
      current_period_end = b.current_period_end,
      apple_original_transaction_id = b.apple_original_transaction_id,
      apple_product_id = b.apple_product_id,
      apple_environment = b.apple_environment;

  return jsonb_build_object('esito', 'legato', 'premium_spostato', true, 'fino', b.current_period_end);
end;
$$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function adotta_braccialetto(uuid, uuid) from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on function adotta_braccialetto(uuid, uuid) from authenticated;
  end if;
end $$;
