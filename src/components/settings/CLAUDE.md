# Modulo IMPOSTAZIONI (parte 1 di 2)

Le regole comuni a tutti i moduli sono in AGENTS.md (radice) e la mappa in
ARCHITETTURA.md: questo file dice solo cosa e QUESTO modulo.

Impostazioni a pannelli (obiettivi, lingua, tema, dimensione testo, dati, account,
moduli utente) piu la rail destra su desktop. E un perimetro unico con
`src/components/consumi` (la schermata Consumi AI). Pagina: `src/app/settings/`.

- Prefissi CSS: `jm-st`, `jm-usage`. CSS nuovo da branch: in `src/app/features.css`.
- Banchi prima del push: `verify-impostazioni`, `verify-lingua`, `verify-parole-misure`,
  `verify-checkout-obiettivi` (piu tsc, eslint, verify-i18n).
- NON toccare: gli altri moduli, `globals.css`, `en.ts`, `src/lib/**` (scheletro).
