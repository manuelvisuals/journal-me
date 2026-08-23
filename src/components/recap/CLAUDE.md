# Modulo RECAP

Le regole comuni a tutti i moduli sono in AGENTS.md (radice) e la mappa in
ARCHITETTURA.md: questo file dice solo cosa e QUESTO modulo.

I recap letterari (mensili, semestrali, annuali): lista, dettaglio, editor. Pagina:
`src/app/recap/`; la generazione passa da `src/app/api/recap/generate` (l'API e un
guscio: la logica che tocca l'AI si discute con Manuel prima).

- Prefissi CSS (misurati il 23 ago): `jm-recap`, `jm-det`, `jm-gen`, `jm-period`,
  `jm-drop`. CSS nuovo da branch: in `src/app/features.css`.
- Banchi prima del push: tsc, eslint, verify-i18n (un banco dedicato al Recap ancora
  non esiste: se lo scrivi, chiamalo `verify-recap.mjs` e provalo a mordere).
- NON toccare: gli altri moduli, `globals.css`, `en.ts`, `src/lib/**` (scheletro).
