-- Quote AI per tier (19 ago 2026, richiesta di Manuel).
-- L'allowance mensile per piano vive qui: la modifichera la pagina admin
-- (solo master, in arrivo) via service role. Gli utenti la leggono
-- soltanto, per la barra della quota in Altro. Valori in USD stimati
-- (stessa unita delle stime di /api/usage).

create table if not exists public.plan_limits (
  tier text primary key,
  monthly_allowance_usd numeric not null default 0
);

insert into public.plan_limits (tier, monthly_allowance_usd)
values ('free', 0), ('premium', 2.00)
on conflict (tier) do nothing;

alter table public.plan_limits enable row level security;

drop policy if exists "read plan limits" on public.plan_limits;

create policy "read plan limits" on public.plan_limits
  for select using (true);
