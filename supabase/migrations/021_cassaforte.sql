-- 021_cassaforte.sql
-- La cassaforte (SPEC-ospite-e-cassaforte.md, R6 R7 R8, §6-bis; mockup
-- design/mockups/codice-di-recupero.html, approvato il 3 settembre 2026).
--
-- Il contenuto di una giornata viene chiuso a chiave SUL DISPOSITIVO prima di
-- partire. Sul server arrivano solo:
--
--   cassaforte_utente  una riga per utente: la PROVA (una frase fissa chiusa
--                      con la chiave del diario), che serve a dire "le parole
--                      sono giuste" su un dispositivo nuovo. Non e la chiave,
--                      e da qui la chiave non si ricostruisce.
--   cassettine         una riga per giorno: di chi e, che giorno e, la
--                      versione, quanto pesa, quando e stata scritta, e la
--                      BUSTA (testo, titolo, sintesi, aree, persone, misure,
--                      obiettivi e fatti del giorno, tutti dentro, illeggibili).
--
-- Il numero di versione (R7) lo fa rispettare il database, non il client:
-- non esiste una policy di insert/update su cassettine, si scrive SOLO con
-- salva_cassettina(), che accetta la scrittura se la versione attesa e quella
-- corrente e altrimenti solleva `versione_superata`. Il server fa tutto
-- questo senza aprire niente: confronta due interi.
--
-- Le tabelle vecchie (entries, facts) restano per le giornate ancora in
-- chiaro (R12): il passaggio alla cassaforte e un tasto esplicito in
-- Impostazioni, che legge, chiude, scrive qui e poi cancella di la.

set search_path = public;

create table if not exists cassaforte_utente (
  user_id uuid primary key references auth.users(id) on delete cascade,
  prova text not null,
  creata_il timestamptz not null default now()
);

alter table cassaforte_utente enable row level security;

create policy "cassaforte_utente_select_own" on cassaforte_utente
  for select using (auth.uid() = user_id);
create policy "cassaforte_utente_insert_own" on cassaforte_utente
  for insert with check (auth.uid() = user_id);
create policy "cassaforte_utente_delete_own" on cassaforte_utente
  for delete using (auth.uid() = user_id);

create table if not exists cassettine (
  user_id uuid not null references auth.users(id) on delete cascade,
  giorno date not null,
  v integer not null default 1,
  busta text not null,
  bytes integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, giorno)
);

create index if not exists cassettine_user_giorno on cassettine (user_id, giorno desc);
create index if not exists cassettine_user_updated on cassettine (user_id, updated_at desc);

alter table cassettine enable row level security;

create policy "cassettine_select_own" on cassettine
  for select using (auth.uid() = user_id);
create policy "cassettine_delete_own" on cassettine
  for delete using (auth.uid() = user_id);
-- NIENTE insert ne update dal client: si passa da salva_cassettina().

-- Scrive una cassettina rispettando la versione.
--   p_v_attesa = 0  -> la riga non deve esistere (prima scrittura)
--   p_v_attesa = n  -> la riga deve essere alla versione n
-- Risponde con la versione nuova. Se la versione non e quella attesa
-- solleva l'eccezione `versione_superata` (SQLSTATE P0001) e non tocca
-- niente: e il client a rileggere la riga e a mostrare le due versioni.
create or replace function salva_cassettina(
  p_giorno date,
  p_v_attesa integer,
  p_busta text
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_corrente integer;
  v_nuova integer;
begin
  if v_uid is null then
    raise exception 'non_autenticato';
  end if;

  select v into v_corrente
    from cassettine
   where user_id = v_uid and giorno = p_giorno
   for update;

  if v_corrente is null then
    if p_v_attesa <> 0 then
      raise exception 'versione_superata';
    end if;
    insert into cassettine (user_id, giorno, v, busta, bytes)
      values (v_uid, p_giorno, 1, p_busta, length(p_busta));
    return 1;
  end if;

  if v_corrente <> p_v_attesa then
    raise exception 'versione_superata';
  end if;

  v_nuova := v_corrente + 1;
  update cassettine
     set v = v_nuova,
         busta = p_busta,
         bytes = length(p_busta),
         updated_at = now()
   where user_id = v_uid and giorno = p_giorno;
  return v_nuova;
end;
$$;

revoke all on function salva_cassettina(date, integer, text) from public;
grant execute on function salva_cassettina(date, integer, text) to authenticated;
