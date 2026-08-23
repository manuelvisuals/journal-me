# Modulo ABBONAMENTO

Le regole comuni a tutti i moduli sono in AGENTS.md (radice) e la mappa in
ARCHITETTURA.md: questo file dice solo cosa e QUESTO modulo.

La forma del modulo (passo D): `components/` le schermate, `styles.css` il
CSS, `en.ts` le traduzioni, `index.ts` la PORTA — l'unica cosa che gli
altri moduli possono importare (il lint dei confini e a ERRORE).

Il muro premium, la schermata di benvenuto premium e il checkout finto
dell'ambiente di prova. Le route Stripe (`src/app/api/stripe/`) e il prezzo
(`src/lib/pricing.ts`) sono scheletro: si toccano d'accordo con Manuel.
Pagina: `src/app/checkout-finto/`.

- Prefissi CSS (misurati): `jm-wall`, `jm-ck`, `jm-cong`.
- La porta esporta openPremiumWall/closePremiumWall/PremiumWall/WallFeature
  e PremiumWelcome: e il modulo piu importato dagli altri, ed e giusto cosi.
- ATTENZIONE App Store: un abbonamento venduto DENTRO l'app iOS deve passare
  da In-App Purchase, non dal checkout Stripe nella webview. La differenza
  web/iOS vivra qui.
- Banchi prima del push: `verify-checkout-obiettivi` (piu tsc, eslint,
  verify-i18n).
