# dayalogue

Diario personale. Voce, memoria, recap.

Mobile-first web app: Next.js + Supabase + Vercel.

## Stack

- Next.js 16 (App Router, TypeScript, Tailwind v4)
- Supabase (Postgres + Auth)
- Vercel (hosting + auto-deploy da GitHub)

## Variabili d'ambiente

Copia `.env.example` in `.env.local` e compila:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Sviluppo

```
npm install
npm run dev
```

## Convenzioni

- Numeri sempre via `LOCALE = "it-IT"` (vedi `src/lib/format.ts`).
- Nessuna emoji in code/config/commit.
- `npx tsc --noEmit` clean prima di ogni push.
- Cambi visivi non triviali: mockup HTML in `design/mockups/` prima del codice di produzione.
- Git author email: `spamming.madh52@gmail.com`.

## Struttura

```
src/
  app/                 App Router pages
  lib/
    format.ts          locale italiana + formatters
design/
  mockups/             mockup HTML per revisione visiva
supabase/
  migrations/          migration SQL (eseguiti via Supabase SQL Editor)
```
