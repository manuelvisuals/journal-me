-- 028_regalo_chiamate.sql
-- Il tetto di chiamate per giornata e il segno di DeviceCheck (audit del 10
-- settembre 2026, decisioni 2A e 4A di Manuel; branch modello-premium).
--
-- Fino a qui "una giornata" costava una riga in braccialetto_giornate e, da
-- quel momento, lavorare ancora su quel giorno era gratis SENZA LIMITE. Con
-- il giorno del diario scelto dal client (4A: la giornata si conta sul giorno
-- su cui l'AI lavora, non sul giorno di calendario del server) un client
-- ostile puo mandare sempre lo stesso giorno e avere AI illimitata pagando
-- una giornata sola. Quindi ogni giornata ha un contatore di chiamate e un
-- tetto: chi lo supera riceve 402 regalo_finito con motivo 'chiamate'. Il
-- tetto e largo (src/lib/regalo.ts, CHIAMATE_PER_GIORNATA): una persona che
-- scrive davvero non lo tocca, un ciclo di curl si.
--
-- Il braccialetto porta anche `devicecheck`: vero se la riga e nata da una
-- registrazione con un token DeviceCheck verificato da Apple (2A). Sul web
-- non esiste un token, quindi con DeviceCheck acceso sul server il web non
-- ha regalo: la regola "sul web non si vende, e non si regala" vive qui.
--
-- Idempotente: si puo rieseguire senza danni.

set search_path = public;

alter table braccialetto_giornate
  add column if not exists chiamate integer not null default 0;

alter table braccialetti
  add column if not exists devicecheck boolean not null default false;

-- La firma cambia (un parametro in piu): la vecchia si toglie, cosi non
-- restano due funzioni con lo stesso nome e PostgREST non deve scegliere.
drop function if exists usa_giornata_ospite(uuid, date, integer, boolean);

create or replace function usa_giornata_ospite(
  p_braccialetto_id uuid,
  p_giorno date,
  p_max integer,
  p_blocca_nuove boolean default false,
  p_max_chiamate integer default 60
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
  fatte integer;
begin
  perform 1 from braccialetti where id = p_braccialetto_id for update;
  if not found then
    return jsonb_build_object('esito', 'bloccato', 'usate', 0, 'gia', false);
  end if;

  select count(*) into n from braccialetto_giornate where braccialetto_id = p_braccialetto_id;
  select chiamate into fatte
    from braccialetto_giornate
    where braccialetto_id = p_braccialetto_id and giorno = p_giorno;

  if found then
    if fatte >= p_max_chiamate then
      return jsonb_build_object('esito', 'chiamate', 'usate', n, 'gia', true, 'chiamate', fatte);
    end if;
    update braccialetto_giornate set chiamate = chiamate + 1
      where braccialetto_id = p_braccialetto_id and giorno = p_giorno;
    update braccialetti set ultimo_uso = now() where id = p_braccialetto_id;
    return jsonb_build_object('esito', 'ok', 'usate', n, 'gia', true, 'chiamate', fatte + 1);
  end if;
  if p_blocca_nuove then
    return jsonb_build_object('esito', 'bloccato', 'usate', n, 'gia', false);
  end if;
  if n >= p_max then
    return jsonb_build_object('esito', 'quota', 'usate', n, 'gia', false);
  end if;

  insert into braccialetto_giornate (braccialetto_id, giorno, chiamate) values (p_braccialetto_id, p_giorno, 1);
  update braccialetti set ultimo_uso = now() where id = p_braccialetto_id;
  return jsonb_build_object('esito', 'ok', 'usate', n + 1, 'gia', false, 'chiamate', 1);
end;
$$;

revoke all on function usa_giornata_ospite(uuid, date, integer, boolean, integer) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function usa_giornata_ospite(uuid, date, integer, boolean, integer) from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on function usa_giornata_ospite(uuid, date, integer, boolean, integer) from authenticated;
  end if;
end $$;
