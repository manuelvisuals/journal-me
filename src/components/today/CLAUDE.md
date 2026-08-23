# Modulo OGGI (parte 1 di 3: la giornata di oggi)

Le regole comuni a tutti i moduli sono in AGENTS.md (radice) e la mappa in
ARCHITETTURA.md: questo file dice solo cosa e QUESTO modulo.

Il modulo Oggi e la schermata principale: racconto a voce/scritto, editor, giornata
raccontata, metriche, obiettivi. E diviso su tre cartelle che vanno considerate UN
perimetro solo: `src/components/today` (questa), `src/components/day` (una giornata
scelta dal calendario) e `src/components/aree` (le icone delle macro-aree). Le pagine
che lo montano: `src/app/page.tsx` e `src/app/giorno/`.

- Prefissi CSS del modulo (misurati il 23 ago): `jm-ed`, `jm-editor`, `jm-fv`,
  `jm-rec`, `jm-day`, `jm-area`, `jm-metric`, `jm-stepper`, `jm-rm`, `jm-goal*`,
  `jm-write`, `jm-add`, `jm-ptt`. L'elenco vero e nei componenti: in dubbio, grep.
  CSS nuovo da branch: in `src/app/features.css`, con questi prefissi.
- Orchestrazione del salvataggio: `src/lib/actions/save-recording.ts` (e scheletro:
  se serve cambiarla, chiedi a Manuel).
- Banchi da far girare prima del push: `verify-pr7`, `verify-testo-giorno`,
  `verify-aree`, `verify-icone-aree`, `verify-titolo-vivo`, `verify-titolo-luoghi`,
  `verify-giornata-larghezze`, `verify-analisi-testo-re` (piu tsc, eslint, verify-i18n).
- NON toccare: gli altri moduli, `globals.css`, `en.ts`, `src/lib/**` (scheletro).
