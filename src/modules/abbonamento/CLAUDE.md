# Modulo ABBONAMENTO

Le regole comuni a tutti i moduli sono in AGENTS.md (radice) e la mappa in
ARCHITETTURA.md: questo file dice solo cosa e QUESTO modulo.

La forma del modulo (passo D): `components/` le schermate, `styles.css` il
CSS, `en.ts` le traduzioni, `index.ts` la PORTA — l'unica cosa che gli
altri moduli possono importare (il lint dei confini e a ERRORE).

Il muro premium, la schermata di benvenuto premium e il checkout finto
dell'ambiente di prova. Le route Stripe (`src/app/api/stripe/`) e il prezzo
(`src/lib/pricing.ts`) sono scheletro: si toccano d'accordo con Manuel.
Pagina: `src/app/(app)/app/checkout-finto/`.

- Prefissi CSS (misurati): `jm-wall`, `jm-ck`, `jm-cong`.
- La porta esporta openPremiumWall/closePremiumWall/PremiumWall/WallFeature
  e PremiumWelcome: e il modulo piu importato dagli altri, ed e giusto cosi.
- ATTENZIONE App Store: un abbonamento venduto DENTRO l'app iOS deve passare
  da In-App Purchase, non dal checkout Stripe nella webview. La differenza
  web/iOS vivra qui.
- Banchi prima del push: `verify-checkout-obiettivi` (piu tsc, eslint,
  verify-i18n).
- Le API del modulo (passo E): `src/modules/abbonamento/server/` —
  stripe-checkout, stripe-webhook, dev-checkout. Le route in `src/app/api/` sono
  gusci. Le chiavi Stripe restano nell'ambiente Vercel.

## L'acquisto dentro l'app iOS (4 settembre 2026, branch `abbonamento-iap`)

Deciso da Manuel: In-App Purchase con StoreKit 2, mensile 4,99 EUR con 14
giorni di prova gratis, annuale pronto ma spento da un interruttore
(`regalo.annuale_attivo`, pannello admin). Mockup approvato:
`design/mockups/abbonamento-iphone.html` (v3). I passi che tocca a Manuel
fare su App Store Connect: `APP-STORE-CONNECT-passi.md`.

- `negozio-ios.ts`: il negozio visto da JavaScript (prodotti, compra,
  ripristina, gestisci, ascolto delle transazioni). Il nativo e
  `ios/App/App/Abbonamento.swift`, registrato in DockVetro.swift. Sul web
  non c'e negozio: il muro rimanda all'App Store (`APP_STORE_URL` in
  pricing.ts, vuota finche l'app non e su App Store Connect). Per i banchi:
  `window.__jmNegozioFinto`.
- LA REGOLA: il telefono non accende mai premium. La transazione va a
  `server/apple-verifica.ts` (POST /api/apple/verifica), che chiede ad Apple
  (`server/apple-api.ts`, App Store Server API con la chiave .p8: env
  `APPLE_IAP_KEY_ID`, `APPLE_IAP_ISSUER_ID`, `APPLE_IAP_PRIVATE_KEY`) e solo
  allora scrive `profiles` (plan_source 'apple', transazione originale,
  scadenza). Rinnovi e disdette: `server/apple-notifiche.ts`
  (POST /api/apple/notifiche, App Store Server Notifications V2, idempotente
  su `apple_notifiche`). Migration 024.
- Il muro (`components/premium-wall.tsx`) e A SCHEDE: una per prodotto,
  prezzo e prova letti da Apple; `openPremiumWall("regalo")` e il muro
  dell'ospite a giornate finite (si apre da solo sull'evento
  `jm:regalo-finito`), con "Continua senza AI".
- Il premium gratis della v1 (`premium-v1.ts`, `PREMIUM_IOS_V1_GRATIS`) e
  spento: la rotta risponde 404. Stripe resta nel codice, inerte.
- Un premium scaduto e un free: `src/lib/piano.ts` (scheletro), usato da
  requirePremium, dalla guardia dell'ospite e da plan.ts.
- Banco: `verify-abbonamento` (30 controlli, con un App Store Server API
  finto che verifica il gettone ES256: scripts/lib/finti-server.mjs e la
  chiave finta scripts/lib/apple-chiave-finta.pem), provato a mordere.
  Prefissi CSS nuovi dentro `jm-wall`: `jm-wall-schede`, `jm-wall-scheda`,
  `jm-wall-quiet`, `jm-wall-nota`.
