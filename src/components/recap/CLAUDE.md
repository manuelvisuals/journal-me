# Modulo RECAP

Le regole comuni a tutti i moduli sono in AGENTS.md (radice) e la mappa in
ARCHITETTURA.md: questo file dice solo cosa e QUESTO modulo.

I recap letterari (mensili, semestrali, annuali): lista, dettaglio, editor. Pagina:
`src/app/recap/`; la generazione passa da `src/app/api/recap/generate` (l'API e un
guscio: la logica che tocca l'AI si discute con Manuel prima).

- Prefissi CSS (misurati il 23 ago): `jm-recap`, `jm-det`, `jm-gen`, `jm-period`,
  `jm-drop`. Il CSS del modulo vive in `src/styles/recap.css` (passo B, 23 ago).
- Le traduzioni del modulo vivono in `src/lib/i18n/catalogs/recap.ts` (passo C).
- Banchi prima del push: tsc, eslint, verify-i18n (un banco dedicato al Recap ancora
  non esiste: se lo scrivi, chiamalo `verify-recap.mjs` e provalo a mordere).
- NON toccare: gli altri moduli, `src/styles/base.css`/`overrides.css`, `en.ts`, `src/lib/**` (scheletro — con UNA eccezione: il catalogo del tuo modulo in `src/lib/i18n/catalogs/`).
