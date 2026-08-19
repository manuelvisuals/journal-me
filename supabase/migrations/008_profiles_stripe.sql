-- PR 11 (pagamento): collegamento Stripe.
-- Il customer id serve a mappare i webhook successivi al checkout
-- (customer.subscription.updated/deleted arrivano col customer, non con
-- l'utente). Unico dove presente; in Postgres un indice unique su colonna
-- nullable ammette piu NULL, quindi niente indice parziale.

alter table public.profiles
  add column if not exists stripe_customer_id text;

create unique index if not exists profiles_stripe_customer_id_key
  on public.profiles (stripe_customer_id);
