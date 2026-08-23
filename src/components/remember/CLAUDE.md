# Modulo RICORDA (parte 1 di 2)

Le regole comuni a tutti i moduli sono in AGENTS.md (radice) e la mappa in
ARCHITETTURA.md: questo file dice solo cosa e QUESTO modulo.

Ricorda: persone, luoghi, todo, note e idee, alimentati a mano e dal racconto. E un
perimetro unico con `src/components/persona` (la scheda di una persona). Pagine:
`src/app/remember/` e `src/app/persona/`.

- Prefissi CSS (misurati il 23 ago): `jm-rem`, `jm-pers`, `jm-qc`. (`jm-person` e
  la pill delle persone e sta nel modulo Oggi.) il CSS del modulo vive in `src/styles/ricorda.css` (passo B, 23 ago).
- Banchi prima del push: `verify-pr8`, `verify-persona-moduli` (piu tsc, eslint,
  verify-i18n).
- NON toccare: gli altri moduli, `src/styles/base.css`/`overrides.css`, `en.ts`, `src/lib/**` (scheletro).
